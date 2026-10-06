import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { EnderecoClienteDto, TelefoneClienteDto } from './criar-cliente.dto';

// Edicao de cliente (PATCH /clientes/:id). Semantica de PATCH: campo AUSENTE
// nao muda; "" limpa (nos campos opcionais). Os limites de tamanho sao os do
// UpdateClienteDto do Radar (swagger) - passar disso seria recusado no envio.
// CPF/CNPJ, tipo de pessoa e codigo NAO sao editaveis: o PATCH do Radar nao os
// aceita.
export class AtualizarClienteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  razaoSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(17)
  inscricaoEstadual?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  rg?: string;

  @IsOptional()
  @ValidateIf((dto: AtualizarClienteDto) => dto.dataNascimento !== '')
  @IsISO8601({ strict: true })
  dataNascimento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nomeMae?: string;

  @IsOptional()
  @ValidateIf((dto: AtualizarClienteDto) => dto.email !== '')
  @IsEmail()
  @MaxLength(1000)
  email?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  limiteCredito?: number;

  // Telefones do cliente = telefones do endereco de cobranca (padrao).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => TelefoneClienteDto)
  telefones?: TelefoneClienteDto[];

  // So quando o usuario escolheu OUTRO endereco (a tela nao reenvia o atual).
  @IsOptional()
  @ValidateNested()
  @Type(() => EnderecoClienteDto)
  enderecoCobranca?: EnderecoClienteDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EnderecoClienteDto)
  enderecoEntrega?: EnderecoClienteDto;

  // true: o endereco de entrega (se o cliente tiver) passa a ser igual ao de
  // cobranca.
  @IsOptional()
  @IsBoolean()
  entregaIgualCobranca?: boolean;
}

export interface EnderecoEdicaoDto {
  cep: string;
  logradouro: string;
  numero: string;
  semNumero: boolean;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  codigoIbge: string | null;
  idMunicipio: string;
}

// GET /clientes/:id/edicao - o que a tela de edicao precisa, ja no formato do
// formulario.
export interface ClienteEdicaoDto {
  id: string;
  cpfCnpj: string | null;
  tipoPessoa: 'Fisica' | 'Juridica' | null;
  codigo: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  inscricaoEstadual: string | null;
  email: string | null;
  limiteCredito: number | null;
  rg: string | null;
  dataNascimento: string | null;
  nomeMae: string | null;
  // false = cliente veio do sync: RG/nascimento/mae nao sao conhecidos aqui
  // (em branco na tela = mantem o que esta no Radar).
  camposPessoaFisicaConhecidos: boolean;
  enderecoCobranca: EnderecoEdicaoDto | null;
  enderecoEntrega: EnderecoEdicaoDto | null;
  entregaIgualCobranca: boolean;
  telefones: { ddd: string; numero: string }[];
  statusEnvioErp: 'PENDENTE' | 'ENVIADO' | 'ERRO';
}

export interface ResultadoEdicaoDto {
  id: string;
  // SEM_ALTERACAO: nada mudou, nada foi enviado. CADASTRO_PENDENTE: cliente
  // ainda nao estava no Radar - a edicao entrou no cadastro que vai ser
  // enviado. ALTERACAO_PENDENTE: cliente ja no Radar - alteracao na fila.
  situacao: 'SEM_ALTERACAO' | 'CADASTRO_PENDENTE' | 'ALTERACAO_PENDENTE';
}
