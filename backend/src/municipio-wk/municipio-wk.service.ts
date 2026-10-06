import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { ErpClientService } from '../erp-client/erp-client.service';
import { REDIS_CLIENT } from '../redis/redis.constants';

const CHAVE_CACHE = 'cache:wk:municipios';
// Lista de municipios praticamente nao muda - uma carga a cada 7 dias basta.
const TTL_SEGUNDOS = 7 * 24 * 60 * 60;

// Subconjunto de GET /empresarial/v1/municipio (confirmado em teste real,
// 2026-10-06: ~5.7 mil municipios, `id` do Radar + `codigoIBGE`).
interface MunicipioWk {
  id: string;
  codigoIBGE: number;
}

// POST /empresarial/v1/cliente (enderecos[].idMunicipio) exige o ID do
// municipio NO RADAR, que nao e' o codigo IBGE - o IBGE vem da API de CEP/
// CNPJ, e este servico traduz IBGE -> idMunicipio. Mapa em Redis (uma chamada
// ao Radar por semana), nunca uma chamada por cadastro.
@Injectable()
export class MunicipioWkService {
  private readonly logger = new Logger(MunicipioWkService.name);
  // Carga em andamento: com o cache frio, N consultas simultaneas esperam a
  // MESMA carga em vez de cada uma baixar a lista inteira do Radar.
  private cargaEmAndamento: Promise<Record<string, string>> | null = null;

  constructor(
    private readonly erpClient: ErpClientService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async idPorCodigoIbge(codigoIbge: string | number): Promise<string | null> {
    const mapa = await this.obterMapa();
    return mapa[String(codigoIbge)] ?? null;
  }

  private async obterMapa(): Promise<Record<string, string>> {
    const emCache = await this.redis.get(CHAVE_CACHE);
    if (emCache) {
      return JSON.parse(emCache) as Record<string, string>;
    }

    this.cargaEmAndamento ??= this.carregarDoRadar().finally(() => {
      this.cargaEmAndamento = null;
    });
    return this.cargaEmAndamento;
  }

  private async carregarDoRadar(): Promise<Record<string, string>> {
    const municipios = await this.erpClient.get<MunicipioWk[]>(
      '/empresarial/v1/municipio',
    );
    const mapa: Record<string, string> = {};
    for (const municipio of municipios) {
      mapa[String(municipio.codigoIBGE)] = municipio.id;
    }
    await this.redis.set(CHAVE_CACHE, JSON.stringify(mapa), 'EX', TTL_SEGUNDOS);
    this.logger.log(`Mapa IBGE -> idMunicipio carregado do Radar (${municipios.length})`);
    return mapa;
  }
}
