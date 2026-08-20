import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empacota so o necessario pra rodar (node_modules minimo + server.js) -
  // usado pelo Dockerfile pra uma imagem de runtime enxuta.
  output: "standalone",
};

export default nextConfig;
