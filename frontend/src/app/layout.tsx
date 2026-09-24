import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/design/app-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Copperline",
  description: "Sistema web Copperline",
};

// Aplica o tema (localStorage > escuro por padrão) ANTES do React hidratar,
// direto na tag <html> - sem isso, a página sempre nasceria clara e
// "piscaria" pro escuro um instante depois (ver theme-toggle.tsx, que só lê
// o que este script já aplicou). Padrão é ESCURO (decisão do usuário,
// 2026-09-21) - só quem escolheu explicitamente "claro" (toggle) continua
// abrindo claro; sem escolha salva, abre escuro. Script inline pequeno o
// bastante pra não valer a pena virar arquivo separado.
const SCRIPT_TEMA = `
(function () {
  try {
    var tema = localStorage.getItem("copperline:tema") || "dark";
    if (tema === "dark") {
      document.documentElement.dataset.theme = "dark";
    }
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="flex min-h-full flex-col bg-background">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
