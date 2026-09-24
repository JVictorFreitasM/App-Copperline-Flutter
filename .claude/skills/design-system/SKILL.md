---
name: design-system
description: |
  Sistema de design visual do projeto (cor, tipografia, espaçamento, componentes) extraído do app de referência "Constructive" (admin dashboard) e aplicado tanto ao sistema web (Next.js/Tailwind) quanto ao app mobile (Flutter). Fonte de verdade visual — qualquer tela nova, web ou mobile, segue estes tokens em vez de estilo ad-hoc.
  Use quando: criar qualquer tela ou componente novo (web ou mobile), definir cor/tipografia/espaçamento, criar sidebar/topbar/card/lista/gráfico/barra de progresso/badge, ou revisar se uma tela está consistente com o resto do sistema.
---

# Design System do Projeto

Extraído de uma imagem de referência real do app "Constructive" (admin dashboard) — o **estilo visual** é reaproveitado mesmo em domínios diferentes (o app de referência mostra Comments/Posts/Pages, nosso sistema mostra pedido/estoque/cliente). O que se aplica é a linguagem visual (cor, forma, tipografia, hierarquia, estrutura da casca do app), não o conteúdo de CMS específico do exemplo.

**Substitui uma versão anterior desta skill** que tinha sido extraída de outra referência (fintech, sidebar escura) — aquela versão estava sendo usada mesmo depois da referência do projeto ter mudado pra "Constructive", causando inconsistência (ver histórico: dashboard reconstruído com sidebar escura quando a referência real tem sidebar clara). Os valores abaixo são a leitura visual atual e definitiva, direto da imagem "Constructive" — se o time tiver os hex exatos da marca, substituir aqui sem mudar a estrutura do documento.

**2026-09-21 — tema escuro adicionado (web, toggle, ESCURO por padrão).** Pedido do usuário, com uma imagem de referência fintech dark (parecida com a versão abandonada mencionada acima) — dessa vez **não substitui** o tema claro, os dois continuam existindo via toggle (ver seção "Tema escuro" abaixo), mas o **padrão do sistema virou o escuro** (quem nunca escolheu um tema abre no escuro; o claro "Constructive" continua disponível pra quem prefere/escolhe manualmente). Propositalmente **não repete** o erro anterior: só a casca (fundo/superfície/texto) muda de tema, a cor de ação (`primary`, azul) continua a mesma nos dois. Aplicado só no Web nesta rodada — mobile fica pendente.

## Princípios visuais

- **Casca do app clara**: sidebar e topbar são **brancas** (mesma cor dos cards), não escuras — a separação da área de conteúdo vem do fundo cinza-azulado bem claro atrás dos cards, não de uma sidebar com cor diferente. (Correção importante: uma versão anterior desta skill/implementação usou sidebar escura — isso estava errado, não vem da referência. Isso vale pro tema CLARO; o tema escuro, ver seção própria abaixo, inverte isso de propósito.)
- **Azul como cor de ação e destaque**: diferente de um sistema "preto = ação primária", aqui o **azul** (`primary`) é a cor de link, aba ativa, item de navegação ativo e a série de dado mais importante (gráfico principal, primeiro KPI). Preto/cinza-escuro (`ink`) é reservado pra texto e títulos, não pra botão de ação. **Isso não muda no tema escuro** — `primary` é a mesma cor nos dois temas, só a casca (fundo/texto) inverte.
- **Paleta de acento por card, não por sistema inteiro**: cada card de KPI (Comments/Posts/Pages) tem SUA PRÓPRIA cor de destaque (azul, laranja, vermelho) — percentual, anel do donut e (quando aplicável) elementos daquele card específico usam essa cor. Não é uma cor por significado semântico fixo (sucesso/erro) — é só variedade visual entre métricas do mesmo tipo de card lado a lado.
- **Números grandes carregam a hierarquia**: o valor mais importante de um card (contagem do donut, "631" do medidor) é tipografado bem maior e mais bold que qualquer outro texto ao redor.
- **Cards brancos flutuando sobre fundo cinza-azulado bem claro** (tema claro) **ou cards cinza-escuro flutuando sobre preto verdadeiro** (tema escuro): sem bordas visíveis — a separação vem de fundo diferente + sombra bem suave (tema claro) ou fundo diferente sozinho (tema escuro, onde sombra não é visível sobre preto), nunca de linha.
- **Cantos arredondados moderados**: nem canto reto, nem o extremo "rounded-3xl" de um app fintech — um raio médio (~16–20px) em cards, pequeno (~10–12px) em elementos internos (chip de ícone, badge).
- **Ícone dentro de chip QUADRADO arredondado, não circular**: nos cards de evento ("Latest Events"), o ícone fica num chip retangular de cantos arredondados (não um círculo) — cada evento com uma cor de fundo diferente (azul clarinho, laranja clarinho, vermelho/rosa clarinho, verde clarinho).

## Tokens de cor

| Token | Valor (claro) | Valor (escuro) | Uso |
|---|---|---|---|
| `background` | `#F5F6FA` (cinza muito claro, tom azulado) | `#0D0D0F` (quase preto — ajustado 2026-09-21, um pouco acima de `#000` puro pra contrastar melhor com `surface`) | Fundo da página, atrás dos cards |
| `surface` | `#FFFFFF` | `#1A1A1D` (cinza bem escuro — separa do fundo) | Fundo dos cards, da sidebar e da topbar |
| `ink` | `#12141D` | `#F2F2F4` (quase branco) | Texto primário, títulos, item de navegação ativo |
| `muted` | `#8A8FA3` | `#9A9AA3` | Texto secundário, labels, item de navegação inativo |
| `primary` | `#4A6CF7` (azul) | `#4A6CF7` (mesma cor — **não inverte**) | Aba/link ativo, item de nav ativo (ícone), série principal de gráfico, cor de destaque do 1º card de KPI |
| `primary-light` | `#E7ECFE` | `rgb(74 108 247 / 18%)` (translúcido — pastel sólido fica gritante sobre preto) | Trilho de donut/progresso do card `primary`, fundo de chip de ícone azul, fundo de destaque de item ativo na sidebar |
| `accent-orange` | `#FFA53E` | `#FFA53E` (mesma cor) | Cor de destaque de KPI/status "médio" (2º card, barra "Subscriber"/"Contributor", badge "NEW") |
| `accent-orange-light` | `#FFEAD2` | `rgb(255 165 62 / 18%)` | Trilho/fundo claro correspondente |
| `accent-red` | `#FF6B6B` | `#FF6B6B` (mesma cor) | Cor de destaque de KPI/status "atenção" (3º card, "Load Time" do medidor) |
| `accent-red-light` | `#FFE1E1` | `rgb(255 107 107 / 18%)` | Trilho/fundo claro correspondente |
| `accent-green` | `#2ED47A` | `#2ED47A` (mesma cor) | Cor de destaque positivo (barra "Subscriber", "Grade" do medidor) |
| `accent-green-light` | `#D9F7E7` | `rgb(46 212 122 / 18%)` | Trilho/fundo claro correspondente |
| `badge` | `#F0F1F5` | `#26262A` | Fundo de badge de contagem neutro (pill numérico ao lado de item de nav) |
| `solid` | `#12141D` (= `ink` claro) | `#F2F2F4` (= `ink` escuro) | Fundo de botão/pill de ênfase total (`PrimaryButton`, badge `enfase`, botão de confirmação de modal, switch ligado) — token **separado** de `ink` de propósito, ver seção "Tema escuro" abaixo pro porquê |
| `on-solid` | `#FFFFFF` | `#0A0A0A` | Texto/ícone sobre `solid` |

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
Fundo branco. Campo de busca à esquerda (pill, fundo `background`, ícone de lupa + placeholder). Nav horizontal central/direita (abas tipo "Dashboard/Pages/Posts..."): aba ativa em `primary` com sublinhado; inativas em `muted`, sem sublinhado. Toggle de tema (sol/lua, ver "Tema escuro" abaixo) + sino de notificação (ícone em círculo neutro) + avatar circular do usuário + nome, à direita.

### Card de KPI com donut (grid no topo)
Fundo branco, canto arredondado médio, sombra suave. Título (`subheading`) + ícone "•••" (menu, opcional) no canto superior direito. Percentual grande, colorido de acordo com a cor de destaque DAQUELE card (`primary`/laranja/vermelho). Anel donut abaixo: arco preenchido na cor do card + trilho no tom claro correspondente (`-light`). Número grande (`display`) centralizado abaixo do anel. Link "View More" (cor do card) no rodapé.

### Card de KPI "número grande no topo" (`KpiHeaderCard`)
Diferente do card de donut acima — layout mais simples, usado nos 3 cards de topo do painel (Épico 1.1, referência `dash.jpg`): título pequeno (`muted`) centralizado no topo, número grande (`display`, cor `ink` ou de ênfase — `accent-red` na referência, pra métrica que "precisa de atenção") centralizado no meio, subtítulo opcional em `accent-green` embaixo (contexto complementar, ex: valor em R$ associado). Sem ícone, sem anel — só hierarquia tipográfica.

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

### Botão sólido (`PrimaryButton`, badge `enfase`, confirmação de modal, switch ligado)
Pill de fundo `solid` + texto `on-solid` — **nunca `bg-ink`/`text-white` direto**. `ink` é token de TEXTO (inverte de escuro→claro no tema escuro); um botão "sólido"/"cheio" precisa continuar de alto contraste contra `background` nos DOIS temas, então usa o par `solid`/`on-solid`, que é definido para sempre contrastar com o fundo do tema atual (escuro sobre fundo claro, claro sobre fundo escuro) em vez de herdar a inversão de `ink`.

### Estado de loading
Skeleton preservando a forma do card real (blocos em tom neutro claro, sem spinner central).

### Estado vazio
Extrapolação nossa (não confirmada pela referência) — mesma linguagem visual (card branco, texto `muted`), sem sair do padrão.

## Tema escuro (toggle) — Web

Adicionado 2026-09-21, a partir de uma referência fintech dark pedida pelo usuário. **Decisões confirmadas com o usuário, registradas aqui pra não reabrir a discussão sem novidade:**

- **Toggle, não substituição — mas ESCURO é o padrão** — os dois temas continuam existindo (ícone sol/lua na Topbar alterna), não é uma reescrita completa da identidade visual claro. Só que, ao contrário da primeira decisão (escuro como opção secundária), o usuário confirmou em seguida que quer o escuro como abertura padrão do sistema: quem nunca trocou de tema (sem preferência salva em `localStorage`) abre no escuro; o claro "Constructive" fica disponível só pra quem escolhe manualmente.
- **Preto verdadeiro, não azul-marinho** — `background: #0D0D0F` (ajustado de `#000000` puro em 2026-09-21, a pedido do usuário, pra contrastar melhor com `surface`; continua neutro/quase-preto, nunca um tom azulado). Pedido explícito do usuário pra não repetir o visual "sidebar escura" abandonado (ver nota no topo do documento) nem cair num dark tipo "cinza-azulado" comum em dashboards fintech genéricos.
- **`primary` (azul) não muda** — mesma cor de ação nos dois temas. Só a casca (fundo/superfície/texto) inverte, os acentos de KPI (`accent-orange/red/green`) também ficam com a MESMA cor "cheia" nos dois temas — só as variantes `-light` (pastéis, viram translúcidas em vez de pastel sólido sobre preto).
- **Só Web nesta rodada** — mobile (Flutter) não foi tocado, fica pendente pra quando/se for priorizado. A convenção de token único pra web+mobile (ver seção "Aplicação no Mobile" abaixo) ainda vale — quando o mobile ganhar tema escuro, deve usar os MESMOS valores desta tabela, não uma leitura nova.

### Mecanismo (Next.js + Tailwind v4)

- Ativado via atributo `data-theme="dark"` na tag `<html>`. Os tokens de cor no `@theme` (`globals.css`) são valores padrão (tema claro); um bloco `:root[data-theme="dark"] { --color-*: ... }` sobrescreve só os tokens que mudam (ver tabela de cores acima) — como os utilitários Tailwind (`bg-background`, `text-ink`, ...) resolvem pra `var(--color-*)`, eles se adaptam sozinhos sem precisar de classe condicional em cada componente.
- **Sem flash de tema errado**: um script inline no `<head>` do `layout.tsx` roda ANTES da hidratação do React, lê `localStorage` (chave `copperline:tema`) e aplica `data-theme="dark"` sempre que não houver escolha salva (padrão) ou a escolha salva for `"dark"` — só quem salvou `"light"` explicitamente (via toggle) abre claro.
- **Toggle**: componente `ThemeToggle` (`components/design/theme-toggle.tsx`), Client Component, ícone sol/lua conforme o tema atual, alterna `document.documentElement.dataset.theme` + persiste em `localStorage`. Colocado na Topbar.
- **Borda/divisor**: em vez de um token `--color-border` separado, usa opacidade sobre `ink` (`border-ink/5`, `border-ink/10`, `bg-ink/10`) — como `ink` já inverte entre os temas, a opacidade produz "linha sutil sobre a superfície" nos dois automaticamente, sem token extra.
- **Sombra**: `shadow-sm` dos cards continua aplicado nos dois temas, mas não é visível sobre preto — a separação cartão/fundo no tema escuro vem só da diferença `surface` (#1A1A1D) vs `background` (#0D0D0F), igual à referência fintech.
- **Gráficos (Recharts)**: cores de eixo/grid/tooltip referenciam `var(--color-muted)`/`var(--color-ink)`/`var(--color-surface)` em vez de hex fixo, pra se adaptarem ao tema. Cores de série (barras, radar) continuam fixas (mesma cor nos dois temas, mesmo critério de `accent-*` acima).

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
  --color-solid: #12141d;
  --color-on-solid: #ffffff;
  --radius-card: 1.25rem;
}

/* Tema escuro (toggle) - ver seção "Tema escuro" acima */
:root[data-theme="dark"] {
  --color-background: #0d0d0f;
  --color-surface: #1a1a1d;
  --color-ink: #f2f2f4;
  --color-muted: #9a9aa3;
  --color-badge: #26262a;
  --color-solid: #f2f2f4;
  --color-on-solid: #0a0a0a;
  --color-primary-light: rgb(74 108 247 / 18%);
  --color-accent-orange-light: rgb(255 165 62 / 18%);
  --color-accent-red-light: rgb(255 107 107 / 18%);
  --color-accent-green-light: rgb(46 212 122 / 18%);
}
```

Componentes de UI compartilhados (`<Card>`, `<Sidebar>`, `<Topbar>`, `<DonutKpiCard>`, `<KpiHeaderCard>`, `<ThemeToggle>`, etc.) extraídos como componentes React reutilizáveis, em vez de repetir a mesma combinação de classes Tailwind em cada tela — ver skill `nextjs-best-practices` para convenção de Tailwind do projeto.

## Aplicação no Mobile (Flutter)

Mesmos tokens como constantes/tema central, não cor literal espalhada pelos widgets. **Tema escuro ainda não aplicado no mobile** (ver seção "Tema escuro" acima) — quando for, usar os mesmos valores de `--color-*` do tema escuro web, não uma leitura visual nova.

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
- Os 3 cards "número grande no topo" (`KpiHeaderCard`) viram **Orçamentos Abertos / Clientes +30 dias sem pedido / Ticket Médio de Vendas** (Épico 1.1).
- A sidebar/topbar viram a casca de navegação do sistema inteiro (não só do dashboard).
