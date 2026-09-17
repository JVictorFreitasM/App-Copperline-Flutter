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

// OS-novas-implementacoes.md Bloco 3 - peso por produto/pedido (Decimal do
// Prisma chega como string, mesmo padrão de formatarMoeda acima).
export function formatarPeso(valorKg: string | null): string {
  if (valorKg === null) {
    return "—";
  }
  const numero = Number(valorKg);
  if (Number.isNaN(numero)) {
    return "—";
  }
  return `${new Intl.NumberFormat("pt-BR").format(numero)} kg`;
}

// Contato de cliente (ContatoCliente.telefoneDdd/telefoneNumero) - "—"
// quando falta qualquer uma das duas partes (nunca mostra so DDD ou so
// numero solto).
export function formatarTelefone(ddd: string | null, numero: string | null): string {
  if (!ddd || !numero) {
    return "—";
  }
  return `(${ddd}) ${numero}`;
}

// Criação de pedido (popup de item/resumo do pedido) - valor ja em
// percentual (ex: 10 -> "10%"), nao fracao (0.1).
export function formatarPercentual(valor: number, casasDecimais = 2): string {
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: casasDecimais })}%`;
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
