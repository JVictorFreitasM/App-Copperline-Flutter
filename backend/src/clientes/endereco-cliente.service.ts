import { BadRequestException, Injectable } from '@nestjs/common';
import { ConsultaCepService } from '../consulta-cep/consulta-cep.service';
import { MunicipioWkService } from '../municipio-wk/municipio-wk.service';
import type { EnderecoClienteDto, TelefoneClienteDto } from './dto/criar-cliente.dto';
import {
  enderecoWkParaBanco,
  type EnderecoParaWk,
  type TipoEndereco,
} from './endereco-wk';

export interface EnderecoResolvido {
  paraWk: EnderecoParaWk;
  paraBanco: Record<string, unknown>;
}

// Endereco digitado na tela (cadastro e edicao) -> formato do Radar, com o
// idMunicipio resolvido (o POST/PATCH exige o id do municipio NO RADAR, que nao
// e o codigo IBGE).
@Injectable()
export class EnderecoClienteService {
  constructor(
    private readonly municipioWkService: MunicipioWkService,
    private readonly consultaCepService: ConsultaCepService,
  ) {}

  async resolver(
    tipo: TipoEndereco,
    endereco: EnderecoClienteDto,
    telefones: TelefoneClienteDto[],
  ): Promise<EnderecoResolvido> {
    const { idMunicipio, codigoIbge } = await this.resolverMunicipio(endereco);
    const semNumero = endereco.semNumero === true || endereco.numero === undefined;
    const paraWk: EnderecoParaWk = {
      tipo,
      cep: endereco.cep,
      logradouro: endereco.logradouro.trim(),
      numero: semNumero ? undefined : endereco.numero,
      semNumero,
      complemento: endereco.complemento?.trim() || undefined,
      bairro: endereco.bairro.trim(),
      idMunicipio,
      telefones,
      email: endereco.email,
    };
    return {
      paraWk,
      paraBanco: enderecoWkParaBanco(paraWk, {
        uf: endereco.uf?.toUpperCase() ?? null,
        codigoIbge,
      }),
    };
  }

  // idMunicipio do Radar: direto, ou via IBGE, ou via CEP -> IBGE. O front ja
  // manda o IBGE (vem da consulta de CEP), mas o backend nao depende disso.
  private async resolverMunicipio(
    endereco: EnderecoClienteDto,
  ): Promise<{ idMunicipio: string; codigoIbge: string | null }> {
    let codigoIbge = endereco.codigoIbge ?? null;
    if (endereco.idMunicipio) {
      return { idMunicipio: endereco.idMunicipio, codigoIbge };
    }

    if (!codigoIbge) {
      try {
        codigoIbge = (await this.consultaCepService.consultar(endereco.cep)).codigoIbge;
      } catch {
        codigoIbge = null;
      }
    }
    const idMunicipio = codigoIbge
      ? await this.municipioWkService.idPorCodigoIbge(codigoIbge)
      : null;
    if (!idMunicipio) {
      throw new BadRequestException(
        `Não foi possível identificar o município do CEP ${endereco.cep} - confira o CEP`,
      );
    }
    return { idMunicipio, codigoIbge };
  }
}
