// Formatação compartilhada por qualquer tela que exiba valor monetário ou
// data vinda da API (produtos, pedidos, ...) - não duplicar por tela.
export function formatarMoeda(valor: string | null): string {
  if (valor === null) {
    return "—";
  }
  const numero = Number(valor);
  if (Number.isNaN(numero)) {
    return "—";
  }
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numero);
}

export function formatarData(valorIso: string | null): string {
  if (valorIso === null) {
    return "—";
  }
  const data = new Date(valorIso);
  if (Number.isNaN(data.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(data);
}

export function formatarDataHora(valorIso: string | null): string {
  if (valorIso === null) {
    return "—";
  }
  const data = new Date(valorIso);
  if (Number.isNaN(data.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}
