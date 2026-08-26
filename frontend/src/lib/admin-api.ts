import "server-only";
import { ApiError } from "./api";
import { resolverApiUrl } from "./login-url";

// Utilitário paralelo ao apiFetch (api.ts), mas pra rotas administrativas
// protegidas por ApiKeyGuard no backend (ex: admin/sync/*) em vez de sessão
// SSO - essas rotas não olham pro cookie do usuário, só pro header
// x-api-key. A chave (ADMIN_API_KEY) fica só aqui, nunca chega ao bundle do
// cliente (import "server-only" garante isso no build) nem é repassada pro
// navegador. Página que chama isso precisa fazer seu próprio controle de
// quem pode chegar até ela (ver exigirUsuarioAutenticado + checagem de role
// em admin/sincronizacao/page.tsx) - o backend não distingue QUEM está por
// trás dessa chamada, só que ela tem a chave certa.
function lerAdminApiKey(): string {
  const chave = process.env.ADMIN_API_KEY;
  if (!chave) {
    throw new Error(
      "ADMIN_API_KEY não configurada - defina no .env do frontend (mesmo valor usado pelo backend).",
    );
  }
  return chave;
}

// Algumas rotas admin/sync respondem 202 sem corpo (ex: executar-agora) -
// diferente de apiFetch, não assume que toda resposta 2xx tem JSON.
export async function adminApiFetch<T = void>(path: string, init?: RequestInit): Promise<T> {
  const url = `${resolverApiUrl()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "x-api-key": lerAdminApiKey(),
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new ApiError(
      `Falha ao conectar com a API em ${url}: ${error instanceof Error ? error.message : String(error)}`,
      0,
      url,
    );
  }

  if (!response.ok) {
    const corpo = await response.text().catch(() => "");
    throw new ApiError(
      `API respondeu ${response.status} para ${url}${corpo ? `: ${corpo}` : ""}`,
      response.status,
      url,
    );
  }

  const corpo = await response.text();
  return (corpo ? JSON.parse(corpo) : undefined) as T;
}
