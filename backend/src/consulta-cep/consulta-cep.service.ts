import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { CepApiClientService } from './cep-api-client.service';
import type { CepApiData } from './cep-api.types';
import { cepEhValido, normalizarCep } from './domain/cep';
import type { ConsultaCepDto } from './dto/consulta-cep-response.dto';

// CEP quase nunca muda de endereco - 30 dias. Inexistente: 1 hora (evita
// martelar o provedor com o mesmo CEP errado, mas deixa um CEP novo da
// base dos Correios aparecer no mesmo dia).
const TTL_CEP_SEGUNDOS = 30 * 24 * 60 * 60;
const TTL_CEP_NAO_ENCONTRADO_SEGUNDOS = 60 * 60;

// Orquestrador: valida o CEP, tenta o cache (Redis) e so entao chama o
// provedor; traduz o shape cru pro nosso DTO.
@Injectable()
export class ConsultaCepService {
  // Consultas em andamento por CEP: pedidos simultaneos do mesmo CEP com o
  // cache frio dividem UMA chamada ao provedor.
  private readonly emAndamento = new Map<string, Promise<ConsultaCepDto>>();

  constructor(
    private readonly cepApiClient: CepApiClientService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async consultar(entrada: string): Promise<ConsultaCepDto> {
    if (!cepEhValido(entrada)) {
      throw new BadRequestException('CEP invalido');
    }
    const cep = normalizarCep(entrada);
    const jaIndo = this.emAndamento.get(cep);
    if (jaIndo) {
      return jaIndo;
    }
    const consulta = this.consultarComCache(cep).finally(() => {
      this.emAndamento.delete(cep);
    });
    this.emAndamento.set(cep, consulta);
    return consulta;
  }

  private async consultarComCache(cep: string): Promise<ConsultaCepDto> {
    const chave = `cache:cep:${cep}`;
    const chaveNegativa = `cache:cep:nao-encontrado:${cep}`;

    const emCache = await this.redis.get(chave);
    if (emCache) {
      return JSON.parse(emCache) as ConsultaCepDto;
    }
    if (await this.redis.get(chaveNegativa)) {
      throw new NotFoundException('CEP nao encontrado');
    }

    let dados: CepApiData;
    try {
      dados = await this.cepApiClient.consultar(cep);
    } catch (error) {
      if (error instanceof NotFoundException) {
        await this.redis.set(
          chaveNegativa,
          '1',
          'EX',
          TTL_CEP_NAO_ENCONTRADO_SEGUNDOS,
        );
      }
      throw error;
    }

    const resultado = this.mapear(dados);
    await this.redis.set(chave, JSON.stringify(resultado), 'EX', TTL_CEP_SEGUNDOS);
    return resultado;
  }

  private mapear(dados: CepApiData): ConsultaCepDto {
    return {
      cep: dados.cep,
      cepFormatado: dados.cepFormatado,
      uf: vazioParaNull(dados.uf),
      localidade: vazioParaNull(dados.nomeLocalidade),
      bairro: vazioParaNull(dados.nomeBairro),
      logradouro: montarLogradouro(dados.tipoLogradouro, dados.nomeLogradouro),
      complemento: vazioParaNull(dados.complementoLogradouro),
      unidade: vazioParaNull(dados.unidade),
      codigoIbge: vazioParaNull(dados.codigoIbge),
    };
  }
}

// Alguns CEPs ja trazem o tipo dentro do nome ("Avenida Paulista, 37" com
// tipo vazio) - so prefixa quando o nome ainda nao comeca com o tipo.
function montarLogradouro(tipo: string, nome: string): string | null {
  const tipoLimpo = tipo.trim();
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) {
    return null;
  }
  const jaTemTipo = nomeLimpo.toLowerCase().startsWith(tipoLimpo.toLowerCase());
  return tipoLimpo && !jaTemTipo ? `${tipoLimpo} ${nomeLimpo}` : nomeLimpo;
}

function vazioParaNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim();
  return texto ? texto : null;
}
