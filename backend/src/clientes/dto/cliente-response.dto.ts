import type { Cliente, ContatoCliente } from '../../../generated/prisma/client';

// So os campos relevantes pra consumo externo (web/mobile) - nunca o campo
// Prisma cru direto (ver skill security-review, "Prisma/Postgres": select
// explicito). Nada aqui expõe arvore fiscal nem dado de sincronizacao interno.
export interface ClienteResumoDto {
  id: string;
  idExternoErp: string;
  cpfCnpj: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  inativo: boolean;
  incompleto: boolean;
  sincronizadoEm: Date;
  // "Pin" de localizacao (OS-BACKEND-28, PATCH /clientes/:id/localizacao) -
  // ate a OS-MOBILE-17 nunca tinha sido exposto em nenhum GET, so usado
  // internamente (validacao de distancia de check-in, ver
  // VisitasService). Necessario pro mapa "clientes da carteira" do
  // vendedor - null quando o cliente ainda nao teve o pin definido.
  localizacaoLat: number | null;
  localizacaoLng: number | null;
}

export interface ContatoClienteDto {
  id: string;
  nome: string | null;
  email: string | null;
  telefoneDdd: string | null;
  telefoneNumero: string | null;
  funcao: string | null;
}

export interface ClienteDetalheDto extends ClienteResumoDto {
  enderecos: unknown;
  contatos: ContatoClienteDto[];
}

export function paraClienteResumoDto(cliente: Cliente): ClienteResumoDto {
  return {
    id: cliente.id,
    idExternoErp: cliente.idExternoErp,
    cpfCnpj: cliente.cpfCnpj,
    razaoSocial: cliente.razaoSocial,
    nomeFantasia: cliente.nomeFantasia,
    inativo: cliente.inativo,
    incompleto: cliente.incompleto,
    sincronizadoEm: cliente.sincronizadoEm,
    localizacaoLat: cliente.localizacaoLat?.toNumber() ?? null,
    localizacaoLng: cliente.localizacaoLng?.toNumber() ?? null,
  };
}

export function paraClienteDetalheDto(
  cliente: Cliente & { contatos: ContatoCliente[] },
): ClienteDetalheDto {
  return {
    ...paraClienteResumoDto(cliente),
    enderecos: cliente.enderecos,
    contatos: cliente.contatos.map((contato) => ({
      id: contato.id,
      nome: contato.nome,
      email: contato.email,
      telefoneDdd: contato.telefoneDdd,
      telefoneNumero: contato.telefoneNumero,
      funcao: contato.funcao,
    })),
  };
}
