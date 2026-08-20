# OSs Pendentes — Web

Arquivo de continuidade — ver `PROJECT-STATUS.md` na raiz do projeto para o
status geral de todas as frentes. Este arquivo cobre só o que falta no web.

---

# OS-WEB-16 — Aplicar o design system no web (retrofit completo)

## Objetivo
Trazer os tokens visuais definidos na skill `design-system` para o projeto
Next.js e aplicá-los retroativamente às cinco telas já implementadas
(clientes, produtos, pedidos, estoque, filtros/detalhe) — todas nasceram
antes dessa skill existir.

## Escopo
- Estender `tailwind.config` com os tokens de cor (`background`, `surface`,
  `ink`, `muted`, `primary`, `primary-light`) e o raio de card definido na
  skill `design-system`.
- Criar os componentes compartilhados como componentes React reutilizáveis:
  - `<Card>`, `<PrimaryButton>`, `<SecondaryButton>`/chip, `<StatCard>`,
    `<ListItem>`, `<LoadingSkeleton>` — conforme especificado na skill.
- Ajustar o layout raiz (navegação) para o padrão web da skill (lateral ou
  superior, não a navegação inferior do padrão mobile).
- **Retrofit das cinco telas já existentes**, uma a uma, trocando estilo
  ad-hoc pelos componentes/tokens centralizados:
  - Listagem de clientes (OS-WEB-11)
  - Listagem de produtos (OS-WEB-12)
  - Listagem de pedidos (OS-WEB-13) — inclui o badge de situação, que deve
    seguir a paleta da skill (preto/cinza para estados neutros, `primary`
    só se fizer sentido, não introduzir verde/vermelho sem necessidade real)
  - Consulta de estoque (OS-WEB-14) — os três estados (encontrado com saldo,
    sem saldo, não encontrado) devem usar o mesmo padrão visual de card,
    não estilos improvisados por estado
  - Filtros e telas de detalhe (OS-WEB-15)
- Cada tela deve continuar funcionando exatamente como está — é retrofit
  visual, não mudança de comportamento/dado.

## Fora de escopo
- Nota fiscal (ainda não implementada — nasce direto com o design system,
  vira OS-WEB-17, sem precisar de retrofit).
- Tema escuro/claro alternável — fora do escopo da skill `design-system`
  como está documentada hoje.
- Qualquer mudança de comportamento, filtro novo, ou dado adicional nas
  telas retrofitadas — só aparência.

## Dependências
OS-WEB-08, OS-WEB-11, OS-WEB-12, OS-WEB-13, OS-WEB-14, OS-WEB-15 (as cinco
telas a serem retrofitadas).

## Skills envolvidas
`design-system`, `nextjs-best-practices`.

## Critérios de aceite
- `tailwind.config` reflete os tokens da skill — nenhuma cor hexadecimal
  literal usada fora do config a partir de agora.
- Os seis componentes compartilhados existem e são reutilizados nas cinco
  telas (não recriados inline em nenhuma delas).
- Cada uma das cinco telas continua funcionando (dado, paginação, filtro,
  estados de erro/vazio) exatamente como antes do retrofit — validar uma
  por uma, não só a última mexida.
- Navegação do layout raiz segue o padrão web, não uma cópia da navegação
  inferior mobile.

---

# OS-WEB-17 — Tela de listagem de nota fiscal

## Objetivo
Tela de negócio consumindo `GET /notas-fiscais` (OS-BACKEND-13), já nascendo
com os componentes/tokens do design system (OS-WEB-16 deve estar concluída
antes desta).

## Escopo
- Página `/notas-fiscais` (Server Component, `fetch` para
  `GET /notas-fiscais`).
- Tabela: número, série, cliente/fornecedor, tipo (Entrada/Saída), data de
  emissão, status fiscal, valor total.
- Aviso visível na tela (não só em documentação) informando que a listagem
  cobre só os últimos 60 dias — evita o usuário achar que uma nota antiga
  "sumiu" quando na verdade nunca foi sincronizada por decisão de design.
- Paginação básica, mesmo padrão das demais.
- Usa os componentes compartilhados criados na OS-WEB-16 (`<Card>`,
  `<ListItem>`, etc.) desde o início — não implementar estilo próprio.

## Fora de escopo
- Filtro de busca e tela de detalhe — entram numa extensão da OS-WEB-15
  (ou uma nova, se necessário) em vez de reabrir essa OS.
- Vínculo clicável para o pedido relacionado — evolução futura.

## Dependências
OS-BACKEND-13 (endpoint), OS-WEB-16 (componentes/tokens do design system).

## Skills envolvidas
`nextjs-best-practices`, `design-system`.

## Critérios de aceite
- Usuário autenticado acessa `/notas-fiscais` e vê a lista real.
- Aviso da janela de 60 dias está visível na tela, não escondido.
- Lista vazia e erro de conexão têm feedback visual, mesmo padrão das
  demais telas.
- Visual consistente com as outras telas (usa os componentes do design
  system, não estilo próprio).

---

## Pendências sem OS definida ainda (aguardando escopo)

- **Tela de consulta de estoque agendado/histórico**: depende da
  OS-BACKEND-14 (sincronização agendada de estoque) existir primeiro, e de
  um endpoint de leitura sobre essa tabela — nenhum dos dois existe ainda.
  Não escrever a OS web até essas duas peças do backend estarem definidas.
- **Dashboard geral / tela inicial com resumo**: mencionado como exemplo
  ilustrativo na skill `design-system` (seção final), mas nunca virou OS
  real — escopo a definir quando for priorizado.
