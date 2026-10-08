import { apiFetch } from "@/lib/api";
import type { ConfiguracaoFuncionalidadesDto } from "@/lib/configuracoes";

// Estado das chaves da aba Configurações > Funcionalidades, só pra esconder/
// avisar na tela - quem recusa de verdade é o backend. Se a consulta falhar,
// assume tudo ligado (a tela segue funcionando e o backend decide no envio).
export async function obterFuncionalidades(): Promise<ConfiguracaoFuncionalidadesDto> {
  try {
    return await apiFetch<ConfiguracaoFuncionalidadesDto>("/configuracoes/funcionalidades", {
      cache: "no-store",
    });
  } catch {
    return { envioPedidosHabilitado: true, cadastroClientesHabilitado: true, envioClientesErpHabilitado: false, atualizadoEm: "" };
  }
}
