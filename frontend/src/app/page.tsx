import { headers } from "next/headers";
import { apiFetch, ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { buildLoginUrl, resolverApiPublicUrl } from "@/lib/login-url";
import { Card } from "@/components/design/card";
import { PrimaryButton } from "@/components/design/button";

interface HealthCheckItem {
  status: string;
  [chave: string]: unknown;
}

interface HealthResponse {
  status: string;
  details?: Record<string, HealthCheckItem>;
}

// Pagina inicial de bootstrap (OS 08) - so confirma que o front consegue
// falar com o backend NestJS de ponta a ponta, antes de qualquer tela de
// negocio ser construida. Server Component: a chamada a API acontece no
// servidor, via apiFetch (src/lib/api.ts), nunca no navegador. A partir da
// OS 10, tambem mostra o estado de login (sem nenhuma tela de negocio real
// ainda - so a prova de que login/logout funcionam ponta a ponta). Não faz
// parte do escopo de retrofit da OS-WEB-16 (não é uma das cinco telas de
// negócio), mas usa os mesmos tokens/Card pra não destoar do resto do app,
// que agora renderiza dentro do mesmo layout (AppShell, bg-background).
export default async function Home() {
  let health: HealthResponse | null = null;
  let erro: string | null = null;

  try {
    health = await apiFetch<HealthResponse>("/health", { cache: "no-store" });
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  const ok = health?.status === "ok";
  const user = await getCurrentUser();
  // API_PUBLIC_URL (nao API_URL) pros links abaixo - sao seguidos pelo
  // NAVEGADOR, que precisa do endereco que ele mesmo enxerga, diferente do
  // hostname interno usado por apiFetch/getCurrentUser (ver login-url.ts).
  const apiPublicUrl = resolverApiPublicUrl();

  const headersList = await headers();
  const host = headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  // Absoluta pro proprio front - o backend redireciona o navegador pra essa
  // URL literal apos o login (idp-client callback.ts nao resolve caminhos
  // relativos contra o front, so contra o proprio backend).
  const returnToPainel = host ? `${proto}://${host}/painel` : "/painel";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-bold text-ink">Copperline</h1>
        <p className="text-sm text-muted">Verificação de conexão com o backend</p>

        {erro ? (
          <Card className="text-left">
            <p className="font-medium text-ink">Falha ao conectar com a API</p>
            <p className="mt-1 text-sm text-muted">{erro}</p>
          </Card>
        ) : (
          <Card className="text-left">
            <p className="font-medium text-ink">API: {health?.status}</p>
            {!ok && <p className="mt-1 text-xs text-muted">Verifique os serviços de apoio.</p>}
            {health?.details && (
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {Object.entries(health.details).map(([nome, item]) => (
                  <li key={nome}>
                    {nome}: {item.status}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card className="text-left">
          {user ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-ink">
                Logado como <span className="font-medium">{user.name}</span>
                {user.role ? ` (${user.role})` : ""}
              </p>
              <PrimaryButton href="/painel" className="shrink-0">
                Painel
              </PrimaryButton>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-ink">Você não está logado.</p>
              <PrimaryButton href={buildLoginUrl(apiPublicUrl, returnToPainel)} className="shrink-0">
                Entrar
              </PrimaryButton>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
