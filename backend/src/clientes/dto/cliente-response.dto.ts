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
  // Cadastro feito por nos (POST /clientes): PENDENTE/ERRO ate o WK Radar
  // aceitar. Cliente vindo do sync e' sempre ENVIADO.
  statusEnvioErp: 'PENDENTE' | 'ENVIADO' | 'ERRO';
  erroEnvioErp: string | null;
}

export interface ContatoClienteDto {
  id: string;
  nome: string | null;
  email: string | null;
  telefoneDdd: string | null;
  telefoneNumero: string | null;
  funcao: string | null;
  criadoLocalmente: boolean;
}

export function paraContatoClienteDto(contato: ContatoCliente): ContatoClienteDto {
  return {
    id: contato.id,
    nome: contato.nome,
    email: contato.email,
    telefoneDdd: contato.telefoneDdd,
    telefoneNumero: contato.telefoneNumero,
    funcao: contato.funcao,
    criadoLocalmente: contato.criadoLocalmente,
  };
}

export interface TelefoneEnderecoDto {
  ddd: string | null;
  numero: string;
}

// Endereco ja normalizado a partir do JSONB cru do WK Radar
// (Cliente.enderecos) - o front/mobile so renderizam, sem cada um repetir o
// parse defensivo do shape solto. Cidade nao existe aqui: o Radar so manda
// idMunicipio/codigoIBGE, sem o nome.
export interface EnderecoClienteDto {
  tipo: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  uf: string | null;
  email: string | null;
  telefones: TelefoneEnderecoDto[];
}

export interface ClienteDetalheDto extends ClienteResumoDto {
  codigo: string | null;
  email: string | null;
  contato: string | null;
  homepage: string | null;
  inscricaoEstadual: string | null;
  enderecos: EnderecoClienteDto[];
  contatos: ContatoClienteDto[];
}

const textoOuNull = (valor: unknown): string | null =>
  typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;

export function paraEnderecosClienteDto(enderecosBrutos: unknown): EnderecoClienteDto[] {
  if (!Array.isArray(enderecosBrutos)) return [];

  return enderecosBrutos
    .filter((bruto): bruto is Record<string, unknown> => typeof bruto === 'object' && bruto !== null)
    .map((bruto) => {
      const telefones = Array.isArray(bruto.telefones) ? bruto.telefones : [];
      return {
        tipo: textoOuNull(bruto.tipo),
        cep: textoOuNull(bruto.cep),
        logradouro: textoOuNull(bruto.nomeEndereco),
        numero:
          bruto.semNumero === true
            ? 'S/N'
            : typeof bruto.numero === 'number'
              ? String(bruto.numero)
              : null,
        complemento: textoOuNull(bruto.complemento),
        bairro: textoOuNull(bruto.bairro),
        uf: textoOuNull(bruto.uf),
        email: textoOuNull(bruto.email),
        telefones: telefones.flatMap((telefone: Record<string, unknown>) => {
          const numero = textoOuNull(telefone?.numero);
          return numero ? [{ ddd: textoOuNull(telefone.ddd), numero }] : [];
        }),
      };
    });
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
    statusEnvioErp: cliente.statusEnvioErp,
    erroEnvioErp: cliente.erroEnvioErp,
  };
}

export function paraClienteDetalheDto(
  cliente: Cliente & { contatos: ContatoCliente[] },
): ClienteDetalheDto {
  return {
    ...paraClienteResumoDto(cliente),
    codigo: cliente.codigo,
    email: cliente.email,
    contato: cliente.contato,
    homepage: cliente.homepage,
    inscricaoEstadual: cliente.inscricaoEstadual,
    enderecos: paraEnderecosClienteDto(cliente.enderecos),
    contatos: cliente.contatos.map(paraContatoClienteDto),
  };
}
