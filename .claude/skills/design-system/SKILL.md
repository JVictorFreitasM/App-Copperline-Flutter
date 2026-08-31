---
name: design-system
description: |
  Sistema de design visual do projeto (cor, tipografia, espaçamento, componentes) extraído do app de referência "Constructive" (admin dashboard) e aplicado tanto ao sistema web (Next.js/Tailwind) quanto ao app mobile (Flutter). Fonte de verdade visual — qualquer tela nova, web ou mobile, segue estes tokens em vez de estilo ad-hoc.
  Use quando: criar qualquer tela ou componente novo (web ou mobile), definir cor/tipografia/espaçamento, criar sidebar/topbar/card/lista/gráfico/barra de progresso/badge, ou revisar se uma tela está consistente com o resto do sistema.
---

# Design System do Projeto

Extraído de uma imagem de referência real do app "Constructive" (admin dashboard) — o **estilo visual** é reaproveitado mesmo em domínios diferentes (o app de referência mostra Comments/Posts/Pages, nosso sistema mostra pedido/estoque/cliente). O que se aplica é a linguagem visual (cor, forma, tipografia, hierarquia, estrutura da casca do app), não o conteúdo de CMS específico do exemplo.

**Substitui uma versão anterior desta skill** que tinha sido extraída de outra referência (fintech, sidebar escura) — aquela versão estava sendo usada mesmo depois da referência do projeto ter mudado pra "Constructive", causando inconsistência (ver histórico: dashboard reconstruído com sidebar escura quando a referência real tem sidebar clara). Os valores abaixo são a leitura visual atual e definitiva, direto da imagem "Constructive" — se o time tiver os hex exatos da marca, substituir aqui sem mudar a estrutura do documento.

## Princípios visuais

- **Casca do app clara**: sidebar e topbar são **brancas** (mesma cor dos cards), não escuras — a separação da área de conteúdo vem do fundo cinza-azulado bem claro atrás dos cards, não de uma sidebar com cor diferente. (Correção importante: uma versão anterior desta skill/implementação usou sidebar escura — isso estava errado, não vem da referência.)
- **Azul como cor de ação e destaque**: diferente de um sistema "preto = ação primária", aqui o **azul** (`primary`) é a cor de link, aba ativa, item de navegação ativo e a série de dado mais importante (gráfico principal, primeiro KPI). Preto/cinza-escuro (`ink`) é reservado pra texto e títulos, não pra botão de ação.
- **Paleta de acento por card, não por sistema inteiro**: cada card de KPI (Comments/Posts/Pages) tem SUA PRÓPRIA cor de destaque (azul, laranja, vermelho) — percentual, anel do donut e (quando aplicável) elementos daquele card específico usam essa cor. Não é uma cor por significado semântico fixo (sucesso/erro) — é só variedade visual entre métricas do mesmo tipo de card lado a lado.
- **Números grandes carregam a hierarquia**: o valor mais importante de um card (contagem do donut, "631" do medidor) é tipografado bem maior e mais bold que qualquer outro texto ao redor.
- **Cards brancos flutuando sobre fundo cinza-azulado bem claro**: sem bordas visíveis — a separação vem de fundo diferente + sombra bem suave, não de linha.
- **Cantos arredondados moderados**: nem canto reto, nem o extremo "rounded-3xl" de um app fintech — um raio médio (~16–20px) em cards, pequeno (~10–12px) em elementos internos (chip de ícone, badge).
- **Ícone dentro de chip QUADRADO arredondado, não circular**: nos cards de evento ("Latest Events"), o ícone fica num chip retangular de cantos arredondados (não um círculo) — cada evento com uma cor de fundo diferente (azul clarinho, laranja clarinho, vermelho/rosa clarinho, verde clarinho).

## Tokens de cor

| Token | Valor aproximado | Uso |
|---|---|---|
| `background` | `#F5F6FA` (cinza muito claro, tom azulado) | Fundo da página, atrás dos cards |
| `surface` | `#FFFFFF` | Fundo dos cards, da sidebar e da topbar |
| `ink` | `#12141D` | Texto primário, títulos, item de navegação ativo |
| `muted` | `#8A8FA3` | Texto secundário, labels, item de navegação inativo |
| `primary` | `#4A6CF7` (azul) | Aba/link ativo, item de nav ativo (ícone), série principal de gráfico, cor de destaque do 1º card de KPI |
| `primary-light` | `#E7ECFE` | Trilho de donut/progresso do card `primary`, fundo de chip de ícone azul, fundo de destaque de item ativo na sidebar |
| `accent-orange` | `#FFA53E` | Cor de destaque de KPI/status "médio" (2º card, barra "Subscriber"/"Contributor", badge "NEW") |
| `accent-orange-light` | `#FFEAD2` | Trilho/fundo claro correspondente |
| `accent-red` | `#FF6B6B` | Cor de destaque de KPI/status "atenção" (3º card, "Load Time" do medidor) |
| `accent-red-light` | `#FFE1E1` | Trilho/fundo claro correspondente |
| `accent-green` | `#2ED47A` | Cor de destaque positivo (barra "Subscriber", "Grade" do medidor) |
| `accent-green-light` | `#D9F7E7` | Trilho/fundo claro correspondente |
| `badge` | `#F0F1F5` | Fundo de badge de contagem neutro (pill numérico ao lado de item de nav) |

## Tipografia

Fonte sans-serif geométrica (Geist, já usada no projeto — não é necessário licenciar uma fonte nova).

| Escala | Tamanho aprox. | Peso | Uso |
|---|---|---|---|
| `display` | 28–32px | Bold | O número mais importante de um card (contagem do donut, valor do medidor) |
| `heading` | 20–22px | Bold | Título da tela/logo da sidebar |
| `subheading` | 15–16px | Semibold | Título de card (ex: "Statistics", "Latest Events") |
| `body` | 14–15px | Medium | Texto principal de item de lista/card |
| `body-muted` | 13px | Regular | Texto secundário (descrição, timestamp) |
| `caption` | 11–12px | Regular/Semibold | Labels pequenos, badges, tags ("New", "Today") |

## Espaçamento e forma

- **Raio de borda dos cards**: médio, ~16–20px (`rounded-card` no Tailwind).
- **Raio de borda de elementos internos** (chip de ícone, badge, botão pequeno): pequeno, ~10–12px — nunca o mesmo raio extremo do card.
- **Padding interno dos cards**: ~20–24px.
- **Espaço entre cards**: ~16px.
- **Botões de ação** (ex: "View Page" nos cards de evento): `rounded-full` (pill), fundo neutro claro, texto escuro — não é um botão "cheio"/preto chamativo, é discreto.

## Componentes

### Sidebar
Fundo branco (`surface`), largura fixa. Logo/nome do produto no topo. Itens de navegação: ícone + label + (badge de contagem numérica OU badge "NEW" laranja) + seta `>` à direita. Item ativo: fundo levemente destacado (`primary-light` bem sutil) com cantos arredondados, ícone e texto em `ink`/`primary`. Itens inativos: ícone e texto em `muted`, badge de contagem em fundo `badge` neutro. Seção "ACTIVE PROJECTS" (ou equivalente do domínio) abaixo da navegação principal: label pequeno maiúsculo em `muted`, lista de itens com um ponto colorido (bolinha, cor variando por item) + nome.

### Topbar
Fundo branco. Campo de busca à esquerda (pill, fundo `background`, ícone de lupa + placeholder). Nav horizontal central/direita (abas tipo "Dashboard/Pages/Posts..."): aba ativa em `primary` com sublinhado; inativas em `muted`, sem sublinhado. Sino de notificação (ícone em círculo neutro) + avatar circular do usuário + nome, à direita.

### Card de KPI com donut (grid no topo)
Fundo branco, canto arredondado médio, sombra suave. Título (`subheading`) + ícone "•••" (menu, opcional) no canto superior direito. Percentual grande, colorido de acordo com a cor de destaque DAQUELE card (`primary`/laranja/vermelho). Anel donut abaixo: arco preenchido na cor do card + trilho no tom claro correspondente (`-light`). Número grande (`display`) centralizado abaixo do anel. Link "View More" (cor do card) no rodapé.

### Card "Statistics" (barras horizontais)
Fundo branco. Título + tag "New" (cinza) "Today" (bold, preto) no canto superior direito. Lista de métricas: label à esquerda + valor à direita (bold), com uma barra de progresso horizontal fina abaixo de cada linha — cor da barra variando por métrica (`primary`/verde/laranja), trilho em `background`. Link "View More ⌄" centralizado no rodapé.

### Card "Site Speed" (medidor radial)
Mesmo cabeçalho do card Statistics (título + tag "New Today"). Medidor radial grande à esquerda: número + unidade centralizados dentro do anel. Legenda à direita: quadrado colorido pequeno + label + valor, uma linha por métrica (ex: verde "Grade 75.4%", vermelho "Load Time 631ms").

### Card "User Stat" (gráfico de área)
Fundo branco, título à esquerda, toggle de período à direita (pills "Weekly/Monthly/Yearly" — ativo com fundo `primary` e texto branco, inativos neutros). Gráfico de área: linha em `primary`, preenchimento abaixo da linha em `primary-light` translúcido, eixo X com datas, eixo Y com valores, sem grid vertical (só linhas horizontais bem sutis). Tooltip/destaque de ponto: pill escuro (`ink` ou `primary`) com ícone + valor.

### Card de evento ("Latest Events")
Fileira horizontal de cards (scroll horizontal se necessário). Cada card: chip de ícone QUADRADO arredondado (não círculo) com fundo `-light` de uma cor de acento (varia por card) + título em negrito ao lado. Descrição em `muted`, 2 linhas. Rodapé: horário (`muted`) à esquerda + botão pill discreto (fundo `background`/neutro, texto `ink`) à direita, tipo "Ver mais"/ação específica do evento.

### Badge de contagem / "NEW"
Pill pequeno (`caption`, `rounded-full` ou raio pequeno). Contagem numérica: fundo `badge` neutro, texto `muted`. Badge "NEW": fundo `accent-orange`, texto branco.

### Estado de loading
Skeleton preservando a forma do card real (blocos em tom neutro claro, sem spinner central).

### Estado vazio
Extrapolação nossa (não confirmada pela referência) — mesma linguagem visual (card branco, texto `muted`), sem sair do padrão.

## Aplicação no Web (Next.js + Tailwind)

Tokens em `@theme` no `globals.css` (Tailwind v4, não `tailwind.config.js`):

```css
@theme {
  --color-background: #f5f6fa;
  --color-surface: #ffffff;
  --color-ink: #12141d;
  --color-muted: #8a8fa3;
  --color-primary: #4a6cf7;
  --color-primary-light: #e7ecfe;
  --color-accent-orange: #ffa53e;
  --color-accent-orange-light: #ffead2;
  --color-accent-red: #ff6b6b;
  --color-accent-red-light: #ffe1e1;
  --color-accent-green: #2ed47a;
  --color-accent-green-light: #d9f7e7;
  --color-badge: #f0f1f5;
  --radius-card: 1.25rem;
}
```

Componentes de UI compartilhados (`<Card>`, `<Sidebar>`, `<Topbar>`, `<DonutKpiCard>`, etc.) extraídos como componentes React reutilizáveis, em vez de repetir a mesma combinação de classes Tailwind em cada tela — ver skill `nextjs-best-practices` para convenção de Tailwind do projeto.

## Aplicação no Mobile (Flutter)

Mesmos tokens como constantes/tema central, não cor literal espalhada pelos widgets:

```dart
// lib/theme/app_colors.dart
class AppColors {
  static const background = Color(0xFFF5F6FA);
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF12141D);
  static const muted = Color(0xFF8A8FA3);
  static const primary = Color(0xFF4A6CF7);
  static const primaryLight = Color(0xFFE7ECFE);
  static const accentOrange = Color(0xFFFFA53E);
  static const accentRed = Color(0xFFFF6B6B);
  static const accentGreen = Color(0xFF2ED47A);
}
```

Seguir a convenção de tema já documentada na skill `flutter-ui-ux`. Widgets compartilhados (`AppCard`, `StatCard`, etc.) reutilizados entre telas, seguindo a separação de UI/estado da skill `flutter-widget`.

## Exemplo aplicado ao nosso domínio (não ao domínio de CMS do exemplo)

- Os 3 cards de donut (Comments/Posts/Pages) viram **Pedidos faturados / Notas autorizadas / Estoque crítico** — mesma estrutura (percentual + anel + número + link), dado real do nosso domínio.
- O card "Statistics" (barras) vira o **resumo de clientes/produtos/pedidos em aberto**.
- O card "Site Speed" (medidor) vira a **saúde do estoque** (percentual sem criticidade).
- O card "User Stat" (gráfico de área) — SEM dado de série diária real disponível no backend hoje, mantido como gráfico de barras categórico (ex: vendas por situação) em vez de inventar uma série temporal que não existe.
- "Latest Events" vira **pedidos recentes / notas fiscais recentes**.
- A sidebar/topbar viram a casca de navegação do sistema inteiro (não só do dashboard).
