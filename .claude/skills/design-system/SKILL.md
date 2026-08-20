---
name: design-system
description: |
  Sistema de design visual do projeto (cor, tipografia, espaçamento, componentes) extraído de um app de referência e aplicado tanto ao sistema web (Next.js/Tailwind) quanto ao app mobile (Flutter). Fonte de verdade visual — qualquer tela nova, web ou mobile, segue estes tokens em vez de estilo ad-hoc.
  Use quando: criar qualquer tela ou componente novo (web ou mobile), definir cor/tipografia/espaçamento, criar botão/card/lista/gráfico/barra de progresso, ou revisar se uma tela está consistente com o resto do sistema.
---

# Design System do Projeto

Extraído de um app de referência (fintech) fornecido como imagem — o **estilo visual** é reaproveitado mesmo em domínios diferentes (o app de referência mostra saldo/transações; nosso sistema mostra pedido/estoque/cliente). O que se aplica é a linguagem visual (cor, forma, tipografia, hierarquia), não o conteúdo financeiro específico do exemplo.

Os valores de cor abaixo são extraídos visualmente da referência — são uma aproximação fiel, não uma leitura de pixel exata. Se o time tiver os hex exatos da marca, substituir aqui sem mudar a estrutura do documento.

## Princípios visuais

- **Paleta quase monocromática**: o sistema é predominantemente preto, branco e cinza claro — a cor de destaque (azul-violeta) é usada com moderação, só em elementos que precisam chamar atenção (CTA principal, progresso, gráfico). Não introduzir cores novas sem necessidade.
- **Números grandes carregam a hierarquia**: o valor mais importante de uma tela (saldo, total, saldo de estoque) é tipografado bem maior e mais bold que qualquer outro texto ao redor — é o primeiro elemento que o olho encontra.
- **Cards brancos flutuando sobre fundo cinza claro**: sem bordas visíveis — a separação vem de fundo diferente + sombra suave, não de linha.
- **Cantos bem arredondados, em tudo**: cards, botões, barras de progresso, avatares — nada com canto reto no sistema de referência.
- **Preto como cor de ação primária**: o botão/CTA mais importante de cada tela é preto com texto branco — não é a cor de destaque (azul) que marca a ação principal, é o preto. O azul é reservado para dado/métrica (progresso, gráfico).

## Tokens de cor

| Token | Valor aproximado | Uso |
|---|---|---|
| `background` | `#F4F4F2` (cinza muito claro, quase off-white) | Fundo da tela, atrás dos cards |
| `surface` | `#FFFFFF` | Fundo dos cards |
| `ink` | `#0A0A0A` | Texto primário, botão de ação principal, item ativo da navegação |
| `muted` | `#8C8C8C` | Texto secundário, labels, item inativo da navegação |
| `primary` | `#4640DE` (azul-violeta) | Progresso preenchido, barra de gráfico em destaque, links/ações secundárias de texto |
| `primary-light` | `#C7CBFA` | Trilho de barra de progresso, barra de gráfico não-destacada, fundo de ícone circular |
| `border-subtle` | não usado | O sistema de referência não usa borda visível — usar sombra suave (`shadow-sm`) em vez de borda para separar card do fundo |

## Tipografia

Fonte sans-serif geométrica (ex: Inter, Manrope, ou equivalente já disponível no projeto — não é necessário licenciar uma fonte específica só por causa da referência).

| Escala | Tamanho aprox. | Peso | Uso |
|---|---|---|---|
| `display` | 32–40px | Bold | O número mais importante da tela (saldo, valor total, saldo de estoque) |
| `heading` | 24–28px | Bold | Título da tela (ex: "Clientes", "Estoque") |
| `subheading` | 16–18px | Semibold | Frase de destaque secundária (ex: "Você tem 3 pedidos pendentes") |
| `body` | 15–16px | Medium | Texto principal de item de lista |
| `body-muted` | 13–14px | Regular | Texto secundário de item de lista (ex: data, código) |
| `caption` | 11–12px | Regular | Labels pequenos, tags, legendas |

## Espaçamento e forma

- **Raio de borda dos cards**: grande, ~20–24px — bem mais arredondado que o padrão de framework (`rounded-3xl` no Tailwind, `BorderRadius.circular(20)` no Flutter).
- **Padding interno dos cards**: generoso, ~20–24px.
- **Espaço entre cards**: ~12–16px.
- **Botões**: `rounded-full` (pill) ou raio muito grande — nunca canto reto.

## Componentes

### Botão primário
Fundo preto (`ink`), texto branco, bem arredondado, ícone opcional à direita (círculo branco com ícone, dentro do próprio botão). É a ação mais importante da tela — só um por tela geralmente.

### Botão/chip secundário
Fundo branco, texto preto, mesmo raio do primário — usado em segmented control (ex: alternância entre duas opções, onde a opção ativa vira o estilo do botão primário e a inativa fica no estilo secundário).

### Card de estatística (grid 2x2)
Ícone dentro de um círculo colorido (fundo `primary-light` ou `ink`, ícone contrastante) + label pequeno (`caption`/`muted`) + valor (`body`, bold). Usado para métricas secundárias de apoio (não é o número principal da tela).

### Barra de progresso
Trilho arredondado em `primary-light`, preenchimento em `primary` ou `ink`. Sempre acompanhada de texto explicando o progresso (ex: "68% do estoque mínimo", não só a barra sozinha sem contexto).

### Gráfico de barras
Minimalista, sem grid de fundo, duas tonalidades (uma clara `primary-light`, uma escura `primary`/`ink` para o valor em destaque) — usar para comparação simples (ex: pedidos por mês), não para dashboards densos.

### Item de lista
Avatar/ícone circular à esquerda + título (`body`) e subtítulo (`body-muted`) empilhados + valor à direita (`body`, alinhado à direita, às vezes com um percentual/tag pequeno abaixo).

### Navegação inferior (mobile) / lateral ou superior (web)
4 itens com ícone + label. Item ativo em `ink` (preto, peso maior); inativos em `muted`. Sem indicador extra além da própria cor/peso — minimalista.

### Estado de loading (confirmado pela referência, não inventado)
A referência mostrou explicitamente esse estado: os mesmos blocos/formas do conteúdo real, preenchidos com um tom neutro claro (variação do `background`/`surface`), sem texto, mantendo o layout idêntico ao estado carregado — não usar um spinner central genérico como padrão principal; preferir esse "skeleton" que preserva a forma da tela final.

### Estado vazio
Não confirmado pela referência (nenhuma imagem mostrou isso) — ao implementar, seguir a mesma linguagem visual (card branco arredondado, texto `muted`, sem sair do padrão de cor/forma já definido), mas isso é extrapolação nossa, não algo extraído da imagem.

## Aplicação no Web (Next.js + Tailwind)

Estender o `tailwind.config` com os tokens acima em vez de usar a paleta padrão do Tailwind:

```js
// tailwind.config.js (trecho)
theme: {
  extend: {
    colors: {
      background: '#F4F4F2',
      surface: '#FFFFFF',
      ink: '#0A0A0A',
      muted: '#8C8C8C',
      primary: '#4640DE',
      'primary-light': '#C7CBFA',
    },
    borderRadius: {
      card: '1.5rem', // ~24px, para cards
    },
  },
},
```

Componentes de UI compartilhados (botão, card, item de lista) devem ser extraídos como componentes React reutilizáveis (`<Card>`, `<PrimaryButton>`, `<StatCard>`) usando essas classes, em vez de repetir a mesma combinação de classes Tailwind em cada tela — ver skill `nextjs-best-practices` para convenção de Tailwind do projeto.

## Aplicação no Mobile (Flutter)

Definir os tokens como constantes/tema central, não espalhar cor literal pelos widgets:

```dart
// lib/theme/app_colors.dart
class AppColors {
  static const background = Color(0xFFF4F4F2);
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF0A0A0A);
  static const muted = Color(0xFF8C8C8C);
  static const primary = Color(0xFF4640DE);
  static const primaryLight = Color(0xFFC7CBFA);
}
```

Seguir a convenção de tema já documentada na skill `flutter-ui-ux` (seção "Theme" — usar `ThemeNotifier`/`NotifierProvider` do Riverpod se o tema precisar ser dinâmico; se for só um tema fixo, um `ThemeData` estático já resolve). Widgets de card/botão/item de lista compartilhados (`AppCard`, `PrimaryButton`, `StatCard`) reutilizados entre telas, seguindo a separação de UI/estado já documentada na skill `flutter-widget`.

## Exemplo aplicado ao nosso domínio (não ao domínio financeiro do exemplo)

Pra deixar claro que o estilo se aplica, não o conteúdo:

- O padrão "número grande + gráfico de barras" do card "Finance" (referência) vira, no nosso sistema, o card de **resumo de pedidos do mês** (número grande = quantidade ou valor total de pedidos, gráfico = pedidos por semana).
- O padrão "Target com barra de progresso" vira **saldo de estoque em relação a um mínimo definido** (ex: "68% do estoque mínimo de Produto X", barra preenchendo conforme o saldo).
- O padrão "lista de pessoas com avatar + valor" (Payment) vira a **listagem de clientes** (avatar/inicial + nome + valor em aberto, ou a listagem de pedidos recentes).
- O padrão "Overview com conta principal + ações rápidas" vira a **tela inicial do sistema** (resumo do dia — pedidos pendentes, estoque baixo, notas fiscais recentes — com ações rápidas tipo "Consultar estoque").
