export interface PontoMapaCalorVendasDto {
  clienteId: string;
  nome: string | null;
  latitude: number;
  longitude: number;
  valorTotal: number;
}

// OS-WEB-39 - so' clientes com Cliente.localizacaoLat/Lng definido (pin
// manual via PATCH /clientes/:id/localizacao, OS-MOBILE-21). Nao existe
// geocodificacao do endereco cadastral do WK Radar (`Cliente.enderecos` e'
// so texto - rua/cidade/UF, sem coordenada) - inventar uma geocodificacao
// aqui exigiria integrar um servico externo novo, fora do escopo desta OS
// ("reaproveitar o mapa ja usado... sem exigir nova sincronizacao"). O
// campo `totalClientesNoPeriodo` deixa explicito que o mapa cobre so uma
// FATIA dos clientes com pedido no periodo, nao o total.
export interface MapaCalorVendasDto {
  pontos: PontoMapaCalorVendasDto[];
  totalClientesNoPeriodo: number;
}
