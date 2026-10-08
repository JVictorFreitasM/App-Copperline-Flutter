import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SegredoCryptoService } from '../common/crypto/segredo-crypto.service';
import { PrismaService } from '../prisma/prisma.service';

export type GrupoCredencialErp = 'RADAR' | 'BI';

export interface DefinicaoCredencialErp {
  chave: string;
  rotulo: string;
  grupo: GrupoCredencialErp;
  // Senha: nunca volta na API, nem mascarada alem de "definida".
  secreta: boolean;
  obrigatoria: boolean;
}

// Unicas chaves editaveis pelo painel - lista fechada de proposito (o PATCH
// nunca grava chave arbitraria). Tudo que o painel nao define continua vindo
// da env var de mesmo nome.
export const CREDENCIAIS_ERP: readonly DefinicaoCredencialErp[] = [
  { chave: 'WK_RADAR_API_URL', rotulo: 'URL da API', grupo: 'RADAR', secreta: false, obrigatoria: true },
  { chave: 'WK_RADAR_EMPRESA', rotulo: 'Empresa', grupo: 'RADAR', secreta: false, obrigatoria: true },
  { chave: 'WK_RADAR_USUARIO', rotulo: 'Usuário', grupo: 'RADAR', secreta: false, obrigatoria: true },
  { chave: 'WK_RADAR_SENHA', rotulo: 'Senha', grupo: 'RADAR', secreta: true, obrigatoria: true },
  { chave: 'WK_RADAR_ID_INTEGRADOR', rotulo: 'ID do integrador', grupo: 'RADAR', secreta: false, obrigatoria: false },
  { chave: 'WK_BI_URL', rotulo: 'URL do Executivo.svc', grupo: 'BI', secreta: false, obrigatoria: true },
  { chave: 'WK_BI_BASE', rotulo: 'Base', grupo: 'BI', secreta: false, obrigatoria: true },
  { chave: 'WK_BI_USUARIO', rotulo: 'Usuário', grupo: 'BI', secreta: false, obrigatoria: true },
  { chave: 'WK_BI_SENHA', rotulo: 'Senha', grupo: 'BI', secreta: true, obrigatoria: true },
  { chave: 'WK_BI_EMPRESA', rotulo: 'Empresa (relatórios)', grupo: 'BI', secreta: false, obrigatoria: true },
  { chave: 'WK_RADAR_ESTOQUE_SVC_URL', rotulo: 'URL do Estoque.svc', grupo: 'BI', secreta: false, obrigatoria: true },
  { chave: 'WK_RADAR_EMPRESARIAL_SVC_URL', rotulo: 'URL do Empresarial.svc', grupo: 'BI', secreta: false, obrigatoria: true },
  { chave: 'WK_RADAR_FINANCEIRO_SVC_URL', rotulo: 'URL do Financeiro.svc', grupo: 'BI', secreta: false, obrigatoria: true },
];

export interface CredencialErpDto extends DefinicaoCredencialErp {
  // Valor atual so para campos NAO secretos (null nos secretos).
  valor: string | null;
  definida: boolean;
  origem: 'painel' | 'ambiente' | 'nenhuma';
}

// Credenciais do ERP (WK Radar / WK BI) editaveis pelo painel, sem mexer em env
// nem reiniciar. Precedencia: valor salvo no painel (cifrado no Postgres com
// SegredoCryptoService) > env var. Mesma interface get/getOrThrow do
// ConfigService de proposito: os clients do ERP trocam so o tipo injetado.
// Leitura SINCRONA de um cache em memoria (carregado no boot e atualizado a
// cada gravacao) - premissa: um unico processo de backend.
@Injectable()
export class CredenciaisErpService implements OnModuleInit {
  private readonly logger = new Logger(CredenciaisErpService.name);
  private sobrescritas = new Map<string, string>();

  // Sobe a cada gravacao: quem guarda estado derivado das credenciais (ex: token
  // do Radar) compara e descarta quando muda.
  versao = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly segredoCrypto: SegredoCryptoService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.recarregar();
    } catch (erro) {
      this.logger.error(`Falha ao carregar credenciais do ERP salvas no painel (usando env): ${String(erro)}`);
    }
  }

  get<T = string>(chave: string): T | undefined {
    return (this.sobrescritas.get(chave) ?? this.configService.get<string>(chave)) as T | undefined;
  }

  getOrThrow<T = string>(chave: string): T {
    const valor = this.get<T>(chave);
    if (valor === undefined || valor === '') {
      throw new Error(`Credencial do ERP ${chave} nao configurada (nem no painel, nem na env)`);
    }
    return valor;
  }

  listar(): CredencialErpDto[] {
    return CREDENCIAIS_ERP.map((definicao) => {
      const doPainel = this.sobrescritas.get(definicao.chave);
      const doAmbiente = this.configService.get<string>(definicao.chave);
      const efetivo = doPainel ?? doAmbiente;
      const definida = efetivo !== undefined && efetivo !== '';
      return {
        ...definicao,
        valor: definicao.secreta ? null : (efetivo ?? null),
        definida,
        origem: doPainel !== undefined ? 'painel' : definida ? 'ambiente' : 'nenhuma',
      };
    });
  }

  // `valores`: chave ausente = nao mexe; string preenchida = grava (cifrada);
  // string vazia/null = remove o valor do painel (volta a valer a env).
  async salvar(valores: Record<string, string | null | undefined>, usuarioSub: string): Promise<void> {
    const permitidas = new Set(CREDENCIAIS_ERP.map((c) => c.chave));
    const desconhecidas = Object.keys(valores).filter((chave) => !permitidas.has(chave));
    if (desconhecidas.length > 0) {
      throw new Error(`Credencial desconhecida: ${desconhecidas.join(', ')}`);
    }

    for (const [chave, bruto] of Object.entries(valores)) {
      if (bruto === undefined) continue;
      const valor = bruto?.trim() ?? '';
      if (valor === '') {
        await this.prisma.credencialErp.deleteMany({ where: { chave } });
        continue;
      }
      const valorCifrado = this.segredoCrypto.criptografar(valor);
      await this.prisma.credencialErp.upsert({
        where: { chave },
        create: { chave, valorCifrado, atualizadoPorSub: usuarioSub },
        update: { valorCifrado, atualizadoPorSub: usuarioSub },
      });
    }
    await this.recarregar();
  }

  private async recarregar(): Promise<void> {
    const linhas = await this.prisma.credencialErp.findMany();
    const novas = new Map<string, string>();
    for (const linha of linhas) {
      try {
        novas.set(linha.chave, this.segredoCrypto.descriptografar(linha.valorCifrado));
      } catch {
        // Linha ilegivel (ex: SEGREDO_CRYPTO_KEY trocada): ignora e cai na env.
        this.logger.error(`Credencial ${linha.chave} ilegivel - usando a env`);
      }
    }
    this.sobrescritas = novas;
    this.versao += 1;
  }
}
