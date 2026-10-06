// Conversoes de endereco entre os tres formatos que o cadastro de cliente usa
// (funcoes puras, sem Prisma/HTTP):
//   - EnderecoParaWk: o NOSSO formato intermediario (ja com idMunicipio);
//   - "Radar": o corpo de endereco do POST/PATCH /empresarial/v1/cliente;
//   - "banco": o JSON gravado em Cliente.enderecos - as MESMAS chaves que o
//     sync grava a partir do GET do Radar, pra o resto do sistema ler sem
//     distinguir linha local de sincronizada.

export type TipoEndereco = 'Padrao' | 'Entrega' | 'Faturamento' | 'Cobranca';

export interface TelefoneWk {
  ddd: string;
  numero: string;
}

export interface EnderecoParaWk {
  tipo: TipoEndereco;
  cep: string;
  logradouro: string;
  numero?: number;
  semNumero: boolean;
  complemento?: string;
  bairro: string;
  idMunicipio: string;
  telefones: TelefoneWk[];
  email?: string;
}

// Chaves aceitas por UpdateEnderecoDto/CreateEnderecoDto (swagger do Radar) - o
// GET devolve mais (uf, codigoIBGE, idTransportadora...), que o PATCH recusaria.
export function enderecoWkParaRadar(endereco: EnderecoParaWk) {
  return {
    tipo: endereco.tipo,
    cep: endereco.cep,
    nomeEndereco: endereco.logradouro,
    semNumero: endereco.semNumero,
    ...(endereco.semNumero ? {} : { numero: endereco.numero ?? 0 }),
    ...(endereco.complemento ? { complemento: endereco.complemento } : {}),
    bairro: endereco.bairro,
    idMunicipio: endereco.idMunicipio,
    telefones: endereco.telefones,
    ...(endereco.email ? { email: endereco.email } : {}),
  };
}

export type EnderecoRadar = ReturnType<typeof enderecoWkParaRadar>;

export function enderecoWkParaBanco(
  endereco: EnderecoParaWk,
  extras: { uf: string | null; codigoIbge: string | null },
): Record<string, unknown> {
  return {
    tipo: endereco.tipo,
    cep: `${endereco.cep.slice(0, 5)}-${endereco.cep.slice(5)}`,
    nomeEndereco: endereco.logradouro,
    numero: endereco.semNumero ? 0 : (endereco.numero ?? 0),
    semNumero: endereco.semNumero,
    complemento: endereco.complemento ?? '',
    bairro: endereco.bairro,
    idMunicipio: endereco.idMunicipio,
    uf: extras.uf,
    codigoIBGE: extras.codigoIbge,
    telefones: endereco.telefones,
    email: endereco.email ?? null,
  };
}

const texto = (valor: unknown): string =>
  typeof valor === 'string' ? valor.trim() : '';

// JSON do banco (vindo do sync ou do nosso cadastro) -> formato intermediario.
// null quando falta o minimo (tipo ou municipio) - endereco legado incompleto
// nunca e reenviado ao Radar a partir daqui.
export function enderecoBancoParaWk(bruto: unknown): EnderecoParaWk | null {
  if (typeof bruto !== 'object' || bruto === null) return null;
  const e = bruto as Record<string, unknown>;
  const tipo = texto(e.tipo) as TipoEndereco;
  const idMunicipio = texto(e.idMunicipio);
  if (!tipo || !idMunicipio) return null;
  const semNumero = e.semNumero === true;
  return {
    tipo,
    cep: texto(e.cep).replace(/\D/g, ''),
    logradouro: texto(e.nomeEndereco),
    numero: semNumero || typeof e.numero !== 'number' ? undefined : e.numero,
    semNumero,
    complemento: texto(e.complemento) || undefined,
    bairro: texto(e.bairro),
    idMunicipio,
    telefones: (Array.isArray(e.telefones) ? e.telefones : []).flatMap(
      (telefone: Record<string, unknown>) => {
        const numero = texto(telefone?.numero);
        return numero ? [{ ddd: texto(telefone.ddd), numero }] : [];
      },
    ),
    email: texto(e.email) || undefined,
  };
}

// Dois enderecos sao "o mesmo" pro usuario (ignora telefones/e-mail e
// formatacao de CEP) - usado pra saber se a entrega e igual a cobranca.
export function mesmoLocal(a: EnderecoParaWk, b: EnderecoParaWk): boolean {
  return (
    a.cep.replace(/\D/g, '') === b.cep.replace(/\D/g, '') &&
    a.logradouro.trim() === b.logradouro.trim() &&
    a.semNumero === b.semNumero &&
    (a.semNumero || a.numero === b.numero) &&
    (a.complemento ?? '').trim() === (b.complemento ?? '').trim() &&
    a.bairro.trim() === b.bairro.trim() &&
    a.idMunicipio === b.idMunicipio
  );
}

// Igualdade completa (local + telefones + e-mail) - base do diff da edicao.
export function enderecosIguais(a: EnderecoParaWk, b: EnderecoParaWk): boolean {
  const telefones = (e: EnderecoParaWk) =>
    e.telefones.map((t) => `${t.ddd}${t.numero}`).join('|');
  return (
    a.tipo === b.tipo &&
    mesmoLocal(a, b) &&
    telefones(a) === telefones(b) &&
    (a.email ?? '').trim() === (b.email ?? '').trim()
  );
}
