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
