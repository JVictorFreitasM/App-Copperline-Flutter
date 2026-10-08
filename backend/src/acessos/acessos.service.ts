import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { subDoAccessToken } from './informacao-sessao';
import type { PlataformaAcesso } from './informacao-sessao';

// Conjunto de `sub` bloqueados no Redis: consulta barata a cada requisicao
// (SISMEMBER) sem ir ao Postgres. A fonte da verdade e' usuarios.bloqueado; o
// conjunto e' reconstruido do banco no boot (perder o Redis nao libera ninguem).
export const CHAVE_BLOQUEADOS = 'acesso:bloqueados';
export const PREFIXO_SESSAO = 'session:';

export interface AcessoSessao {
  plataforma: PlataformaAcesso;
  dispositivo: string;
  ip: string | null;
  criadoEm: string;
  ultimoAcessoEm: string;
}

export interface SessaoAtivaDto extends AcessoSessao {
  id: string;
}

export interface ContaAcessoDto {
  id: string;
  nome: string;
  email: string;
  bloqueado: boolean;
  bloqueadoEm: string | null;
  motivoBloqueio: string | null;
  dispositivosPush: number;
  sessoes: SessaoAtivaDto[];
}

interface SessaoRedis {
  chave: string;
  sub: string;
  acesso: AcessoSessao | null;
}

// Tela "Acessos" (admin): lista contas com as sessoes/aparelhos ativos e permite
// bloquear a conta ou encerrar uma sessao. Vale so' para o App Copperline - o IdP
// e os outros sistemas do parque nao sao tocados.
@Injectable()
export class AcessosService implements OnModuleInit {
  private readonly logger = new Logger(AcessosService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const bloqueados = await this.prisma.usuario.findMany({
        where: { bloqueado: true },
        select: { sub: true },
      });
      const pipeline = this.redis.multi().del(CHAVE_BLOQUEADOS);
      if (bloqueados.length > 0) pipeline.sadd(CHAVE_BLOQUEADOS, ...bloqueados.map((u) => u.sub));
      await pipeline.exec();
    } catch (erro) {
      this.logger.error(`Falha ao sincronizar contas bloqueadas no Redis: ${String(erro)}`);
    }
  }

  async estaBloqueado(sub: string): Promise<boolean> {
    return (await this.redis.sismember(CHAVE_BLOQUEADOS, sub)) === 1;
  }

  async listar(): Promise<ContaAcessoDto[]> {
    const [usuarios, sessoes] = await Promise.all([
      this.prisma.usuario.findMany({
        orderBy: { nome: 'asc' },
        include: { _count: { select: { dispositivos: true } } },
      }),
      this.lerSessoes(),
    ]);
    const sessoesPorSub = new Map<string, SessaoRedis[]>();
    for (const sessao of sessoes) {
      sessoesPorSub.set(sessao.sub, [...(sessoesPorSub.get(sessao.sub) ?? []), sessao]);
    }
    return usuarios.map((usuario) => ({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      bloqueado: usuario.bloqueado,
      bloqueadoEm: usuario.bloqueadoEm?.toISOString() ?? null,
      motivoBloqueio: usuario.motivoBloqueio,
      dispositivosPush: usuario._count.dispositivos,
      sessoes: (sessoesPorSub.get(usuario.sub) ?? [])
        .map(paraSessaoDto)
        .sort((a, b) => b.ultimoAcessoEm.localeCompare(a.ultimoAcessoEm)),
    }));
  }

  async bloquear(usuarioId: string, adminSub: string, motivo?: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Conta não encontrada');
    if (usuario.sub === adminSub) {
      throw new BadRequestException('Você não pode bloquear a própria conta');
    }
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        bloqueado: true,
        bloqueadoEm: new Date(),
        bloqueadoPorSub: adminSub,
        motivoBloqueio: motivo?.trim() || null,
      },
    });
    await this.redis.sadd(CHAVE_BLOQUEADOS, usuario.sub);
    await this.encerrarSessoesDe(usuario.sub);
  }

  async desbloquear(usuarioId: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Conta não encontrada');
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { bloqueado: false, bloqueadoEm: null, bloqueadoPorSub: null, motivoBloqueio: null },
    });
    await this.redis.srem(CHAVE_BLOQUEADOS, usuario.sub);
  }

  // Derruba so' aquela sessao (celular/navegador): a pessoa pode logar de novo.
  async encerrarSessao(idSessao: string): Promise<void> {
    const sessao = (await this.lerSessoes()).find((s) => idDaSessao(s.chave) === idSessao);
    if (!sessao) throw new NotFoundException('Sessão não encontrada (já expirou ou foi encerrada)');
    await this.redis.del(sessao.chave);
  }

  private async encerrarSessoesDe(sub: string): Promise<void> {
    const chaves = (await this.lerSessoes()).filter((s) => s.sub === sub).map((s) => s.chave);
    if (chaves.length > 0) await this.redis.del(...chaves);
  }

  private async lerSessoes(): Promise<SessaoRedis[]> {
    const chaves: string[] = [];
    let cursor = '0';
    do {
      const [proximo, lote] = await this.redis.scan(cursor, 'MATCH', `${PREFIXO_SESSAO}*`, 'COUNT', 200);
      cursor = proximo;
      chaves.push(...lote);
    } while (cursor !== '0');
    if (chaves.length === 0) return [];

    const valores = await this.redis.mget(chaves);
    const sessoes: SessaoRedis[] = [];
    valores.forEach((valor, indice) => {
      if (!valor) return;
      try {
        const sessao = JSON.parse(valor) as {
          idpAuth?: { accessToken?: unknown };
          acesso?: AcessoSessao;
        };
        const sub = subDoAccessToken(sessao.idpAuth?.accessToken);
        if (sub) sessoes.push({ chave: chaves[indice], sub, acesso: sessao.acesso ?? null });
      } catch {
        // Sessao ilegivel (ex: so' de OAuth state, sem login) - ignora.
      }
    });
    return sessoes;
  }
}

// Id publico da sessao: hash do id do Redis. O id cru nunca sai da API (junto
// do segredo do cookie ele permitiria assumir a sessao).
export function idDaSessao(chaveRedis: string): string {
  return createHash('sha256').update(chaveRedis).digest('hex').slice(0, 16);
}

function paraSessaoDto(sessao: SessaoRedis): SessaoAtivaDto {
  const semRegistro = new Date(0).toISOString();
  return {
    id: idDaSessao(sessao.chave),
    plataforma: sessao.acesso?.plataforma ?? 'desconhecida',
    dispositivo: sessao.acesso?.dispositivo ?? 'Sem registro ainda (sessão anterior a esta tela)',
    ip: sessao.acesso?.ip ?? null,
    criadoEm: sessao.acesso?.criadoEm ?? semRegistro,
    ultimoAcessoEm: sessao.acesso?.ultimoAcessoEm ?? semRegistro,
  };
}
