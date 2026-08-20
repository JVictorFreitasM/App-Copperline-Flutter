import { exigirUsuarioAutenticado } from "@/lib/auth";
import { Card } from "@/components/design/card";

// Rota protegida de exemplo (OS 10) - demonstra o fluxo de auth ponta a
// ponta (proxy bloqueando sem cookie, getCurrentUser() validando de
// verdade via /auth/me, logout). Nao e uma tela de negocio. Retrofit
// visual (OS-WEB-16): links de navegação removidos daqui - agora vivem no
// SiteHeader global (layout.tsx), presente em toda página autenticada.
export default async function PainelPage() {
  const user = await exigirUsuarioAutenticado("/painel");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="w-full max-w-md">
        <h1 className="mb-4 text-center text-2xl font-bold text-ink">Painel</h1>
        <Card className="text-left text-ink">
          <p>
            <span className="font-medium">Nome:</span> {user.name}
          </p>
          <p>
            <span className="font-medium">E-mail:</span> {user.email}
          </p>
          <p>
            <span className="font-medium">Papel:</span> {user.role ?? "—"}
          </p>
        </Card>
      </div>
    </main>
  );
}
