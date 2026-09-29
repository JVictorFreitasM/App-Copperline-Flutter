import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empacota so o necessario pra rodar (node_modules minimo + server.js) -
  // usado pelo Dockerfile pra uma imagem de runtime enxuta.
  output: "standalone",
  experimental: {
    serverActions: {
      // Default do Next e' 1MB - baixo demais pro upload em massa de
      // imagens de produto (admin/produtos/actions.ts, pedido do usuario
      // 2026-09-29: varias dezenas/centenas de arquivos numa chamada so).
      // 50mb cobre bem centenas de fotos JPEG comprimidas tipicas (a
      // validacao de 5MB por arquivo continua no backend, ver
      // TAMANHO_MAXIMO_IMAGEM_BYTES).
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
