// Mesmo shape de backend/src/clientes/dto/cliente-response.dto.ts
// (ClienteResumoDto) - duplicado aqui por não haver pacote compartilhado
// entre front e back (mesmo padrão de CurrentUser em auth.ts).
export interface ClienteResumoDto {
  id: string;
  idExternoErp: string;
  cpfCnpj: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  inativo: boolean;
  incompleto: boolean;
  sincronizadoEm: string;
}

export interface ContatoClienteDto {
  id: string;
  nome: string | null;
  email: string | null;
  telefoneDdd: string | null;
  telefoneNumero: string | null;
  funcao: string | null;
}

// `enderecos` é `unknown` no backend também (JSONB repassado cru do WK
// Radar, sem schema estável - ver schema.prisma) - não fingir um shape
// aqui que não temos como garantir.
export interface ClienteDetalheDto extends ClienteResumoDto {
  enderecos: unknown;
  contatos: ContatoClienteDto[];
}
