// Stub de teste - puppeteer-core so e' resolvido em runtime real (Chromium
// via Dockerfile), nunca em teste unitario/integracao leve (sem browser no
// ambiente de teste). Sem isso, qualquer spec que so' importe (por cadeia
// de imports, ex: PedidosController -> PedidoPdfService) o modulo real
// quebra o parse do Jest (puppeteer-core exporta ESM puro, que o
// transform padrao do ts-jest nao cobre pra node_modules).
export default {
  launch: () => {
    throw new Error('puppeteer-core.launch() chamado em ambiente de teste - use um mock explicito do PedidoPdfService.');
  },
};
