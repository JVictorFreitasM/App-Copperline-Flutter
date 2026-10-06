import { BadRequestException, Injectable } from '@nestjs/common';
import { CepApiClientService } from './cep-api-client.service';
import type { CepApiData } from './cep-api.types';
import { cepEhValido, normalizarCep } from './domain/cep';
import type { ConsultaCepDto } from './dto/consulta-cep-response.dto';

// Orquestrador: valida o CEP antes de chamar o provedor e traduz o shape
// cru pro nosso DTO.
@Injectable()
export class ConsultaCepService {
  constructor(private readonly cepApiClient: CepApiClientService) {}

  async consultar(entrada: string): Promise<ConsultaCepDto> {
    if (!cepEhValido(entrada)) {
      throw new BadRequestException('CEP invalido');
    }
    const dados = await this.cepApiClient.consultar(normalizarCep(entrada));
    return this.mapear(dados);
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
