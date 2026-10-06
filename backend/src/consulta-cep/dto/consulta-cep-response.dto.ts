// Endereco de um CEP normalizado pro nosso formato - o front nunca ve o
// shape cru do provedor.
export interface ConsultaCepDto {
  cep: string;
  cepFormatado: string;
  uf: string | null;
  localidade: string | null;
  bairro: string | null;
  logradouro: string | null;
  complemento: string | null;
  // Nome do local quando o CEP e de um endereco unico (empresa, edificio).
  unidade: string | null;
  codigoIbge: string | null;
}
