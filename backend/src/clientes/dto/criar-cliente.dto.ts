import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class TelefoneClienteDto {
  @IsString()
  @Matches(/^\d{2}$/, { message: 'ddd deve ter 2 dígitos' })
  ddd!: string;

  @IsString()
  @Matches(/^\d{8,9}$/, { message: 'numero deve ter 8 ou 9 dígitos' })
  numero!: string;
}

// Endereco no formato do cadastro (cobranca / entrega). O municipio vem do
// codigo IBGE (que a API de CEP/CNPJ devolve) - o backend traduz pro
// idMunicipio do WK Radar; `idMunicipio` direto so existe pra quem ja o tem.
export class EnderecoClienteDto {
  @IsString()
  @Matches(/^\d{8}$/, { message: 'cep deve ter 8 dígitos (sem hífen)' })
  cep!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(84)
  logradouro!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999999)
  numero?: number;

  @IsOptional()
  @IsBoolean()
  semNumero?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  complemento?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  bairro!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{7}$/, { message: 'codigoIbge deve ter 7 dígitos' })
  codigoIbge?: string;

  @IsOptional()
  @IsString()
  idMunicipio?: string;

  // So pra exibicao local (o WK Radar resolve cidade/UF pelo idMunicipio).
  @IsOptional()
  @IsString()
  @MaxLength(60)
  cidade?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  uf?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => TelefoneClienteDto)
  telefones?: TelefoneClienteDto[];

  @IsOptional()
  @IsEmail()
  email?: string;

  // Pino do mapa (OpenStreetMap) - vira a localizacao do cliente
  // (Cliente.localizacaoLat/Lng), usada na validacao de check-in de visita.
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
}

// Limites do CreateContatoDto do Radar (swagger).
export class ContatoNovoClienteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  funcao?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(64)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}$/)
  telefoneDdd?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{8,9}$/)
  telefoneNumero?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  dataNascimento?: string;
}

// Limites de tamanho = os do CreateClienteDto do Radar (swagger, 2026-10-06):
// passar disso seria recusado so no envio, depois de o cliente ja estar salvo.
export class CriarClienteDto {
  // CPF ou CNPJ, com ou sem pontuacao - validado por calculo (DV) no backend.
  @IsString()
  @MaxLength(18)
  cpfCnpj!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  codigo?: string;

  // Razao social (PJ) ou nome (PF).
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  razaoSocial!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(17)
  inscricaoEstadual?: string;

  // Pessoa fisica (informacoesCadastrais no Radar) - ignorados pra CNPJ.
  @IsOptional()
  @IsString()
  @MaxLength(15)
  rg?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  dataNascimento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nomeMae?: string;

  @ValidateNested()
  @Type(() => EnderecoClienteDto)
  enderecoCobranca!: EnderecoClienteDto;

  // Omitido = so o endereco de cobranca (padrao) e' enviado. Quando o usuario
  // marca "entrega igual a cobranca", o front manda o MESMO endereco aqui.
  @IsOptional()
  @ValidateNested()
  @Type(() => EnderecoClienteDto)
  enderecoEntrega?: EnderecoClienteDto;

  // Telefones do cliente - o WK Radar guarda telefone dentro do endereco, entao
  // vao no endereco de cobranca (padrao).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => TelefoneClienteDto)
  telefones?: TelefoneClienteDto[];

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  limiteCredito?: number;

  // Pelo menos UM contato e obrigatorio pra cadastrar o cliente.
  @IsArray()
  @ArrayMinSize(1, { message: 'Adicione pelo menos um contato' })
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ContatoNovoClienteDto)
  contatos!: ContatoNovoClienteDto[];
}

// Resposta do POST /clientes - o cliente ja existe localmente (PENDENTE) e
// aparece na carteira de quem cadastrou; o envio ao ERP e' assincrono.
export interface ClienteCriadoDto {
  id: string;
  statusEnvioErp: 'PENDENTE' | 'ENVIADO' | 'ERRO';
}
