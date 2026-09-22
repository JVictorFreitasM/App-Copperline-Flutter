import { parseDecimalBr } from '../common/parse-decimal-br';
import type { EstoqueItemDto } from './dto/estoque-response.dto';

// Nomes de campo confirmados via chamada real ao WK BI (skill
// wk-radar-bi-client, modelo "Saldo de Produtos por Local de Estocagem -
// BOT") - com ponto/espaco, por isso via indice em vez de dot notation.
// Nao e' um contrato estavel da API: vem do modelo do relatorio salvo no
// WK Radar, poderia mudar se o modelo for alterado do lado de la.
interface LinhaSaldoEstoqueWkBi {
  Lote?: string;
  'Fabricado Em'?: string;
  'Código Local'?: string;
  'Nome do Local'?: string;
  'Qtde Estoque'?: string;
}

export function mapearLotesWkBi(
  linhas: Record<string, unknown>[],
): EstoqueItemDto[] {
  return linhas.map((linha) => {
    const l = linha as LinhaSaldoEstoqueWkBi;
    return {
      // '' vira null (confirmado: ~1,5% das linhas do catalogo real tem
      // Lote vazio - produto sem controle de lote, ex: tinta/embalagem).
      lote: l.Lote || null,
      fabricadoEm: l['Fabricado Em'] || null,
      localCodigo: l['Código Local'] || null,
      localNome: l['Nome do Local'] || null,
      quantidade: parseDecimalBr(String(l['Qtde Estoque'] ?? '0')),
    };
  });
}

export function somarQuantidadeFisicaTotal(itens: EstoqueItemDto[]): string {
  const soma = itens.reduce((acumulado, item) => acumulado + Number(item.quantidade), 0);
  return soma.toFixed(4);
}
