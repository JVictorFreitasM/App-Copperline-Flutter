import "server-only";
import { cookies } from "next/headers";
import { resolverApiUrl } from "./login-url";

// Utilitário central de acesso à API NestJS - toda chamada ao backend passa
// por aqui, nunca fetch solto em cada página (ver skill nextjs-best-practices,
// "Backend Integration"). O import "server-only" acima faz o build falhar
// se este módulo for importado por engano num Client Component - API_URL
// nunca deve chegar ao bundle do navegador.
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// fetch server-side com a base da API já injetada e tratamento de erro
// consistente (rede indisponível vs. resposta HTTP de erro) - usar em
// Server Components/Server Actions em vez de chamar fetch diretamente.
// Repassa o cookie de sessão do navegador pro backend (mesma lógica de
// getCurrentUser() em auth.ts) - necessário pra qualquer endpoint protegido
// por requireAuth (clientes/produtos/pedidos/estoque etc.), inofensivo pra
// endpoint público (ex: /health, que ignora o header).
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const url = `${resolverApiUrl()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
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

  return response.json() as Promise<T>;
}
