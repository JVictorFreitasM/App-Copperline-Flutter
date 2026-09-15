# OS — Novas Implementações (Tabelas de Preço, Pedidos, Produtos, Visitas)

Formato pensado para o Claude Code executar: contexto do estado atual do código (já li o schema/serviços relevantes), decisão de design, passos de implementação e critério de aceite. Onde a regra de negócio não estava 100% definida no pedido original, marquei como **⚠️ Decisão necessária antes de codar** — o Claude Code não deve assumir esses pontos sozinho, deve confirmar com o time antes de implementar aquele trecho.

Numeração provisória, ajustar para a sequência real do backlog.

---

## Bloco 1 — Tabelas de preço por cliente / por vendedor

### Estado atual (importante para dimensionar o esforço)

Hoje `TabelaPreco` é tratada como **singleton global**: `ConfiguracaoTabelaPreco` guarda um único `codigoSelecionado`, e `TabelaPrecoSyncStrategy` só sincroniza essa uma tabela (decisão deliberada — sincronizar todas as tabelas leva 90–190s contra poucos segundos para uma só, ver comentário em `schema.prisma` acima de `TabelaPreco`). `PrecoProdutoService` resolve preço sempre a partir dessa tabela única, sem noção de cliente ou vendedor.

O pedido novo exige múltiplas tabelas simultâneas, associadas por cliente e por vendedor. Isso é uma mudança de arquitetura, não um ajuste pontual — impacta sync, schema e todos os pontos que hoje chamam `PrecoProdutoService`.

### ⚠️ Decisões necessárias antes de codar

1. **Sincronização de múltiplas tabelas**: se o admin puder selecionar N tabelas (uma por cliente/vendedor), o sync vai precisar acompanhar todas as N ao mesmo tempo, não mais uma. Confirmar com o time se isso é aceitável em termos de tempo de sync (a atual janela de "poucos segundos por tabela" deve seguir linear com N) e se `TabelaPrecoSyncStrategy.fetch()` deve mudar de "1 código configurado" para "lista de códigos configurados, de todas as fontes: `ConfiguracaoTabelaPreco` legado + as novas associações cliente/vendedor".
2. **Tabela "fixa" vs "múltiplas escolhas"**: o pedido diz duas coisas em sequência — (a) "se o cliente tiver uma tabela fixa, o vendedor só usa essa"; (b) "podemos ter mais de uma tabela para o mesmo cliente, o admin seleciona quais tabelas cada vendedor vê". Interpretação proposta, a confirmar: um `Cliente` pode ter **uma ou mais** tabelas de preço associadas; quando só há uma, o vendedor não escolhe (é a única disponível = comportamento "fixa"); quando há mais de uma, o admin define, por vendedor, quais dessas tabelas aquele vendedor específico pode ver/usar para aquele cliente. Confirmar se essa leitura está correta antes de desenhar o schema.
3. **O que acontece se nenhuma tabela estiver associada ao cliente?** Cair no comportamento legado (`ConfiguracaoTabelaPreco` global) como fallback, ou bloquear a criação de pedido? Confirmar.
4. **Papel de `ConfiguracaoTabelaPreco` (config global antiga) depois dessa mudança**: continua existindo como fallback, ou é substituída por completo pelas associações por cliente? Precisa de decisão para não deixar duas fontes de verdade conflitantes.

### OS-BACKEND-XX — Modelar associação de tabelas de preço por cliente e por vendedor

**O que fazer (após as decisões acima confirmadas):**
- Criar migration Prisma com um novo modelo, por exemplo `TabelaPrecoCliente` (`clienteId`, `tabelaPrecoId`, timestamps) para "quais tabelas esse cliente pode usar", e `TabelaPrecoClienteVendedor` (ou campo em `ClienteVendedor`) para "qual(is) dessas tabelas esse vendedor específico enxerga para esse cliente" — seguindo o mesmo padrão de tabela de vínculo N:N já usado em `ClienteVendedor`.
- Se a decisão do item 3 acima for "fallback para a configuração global", manter `ConfiguracaoTabelaPreco` como estava; caso contrário, avaliar depreciação formal (não remover sem plano de migração de dado).
- Endpoints administrativos novos (padrão `Admin*Controller` + `requireRole('admin')`, igual a `AdminTabelasPrecoController`):
  - `POST/DELETE /admin/clientes/:clienteId/tabelas-preco` — associar/desassociar tabela(s) ao cliente.
  - `POST/DELETE /admin/clientes/:clienteId/tabelas-preco/:tabelaPrecoId/vendedores/:vendedorId` — restringir visibilidade daquela tabela para aquele vendedor.
- Endpoint de leitura para o vendedor/painel saber quais tabelas estão disponíveis para um cliente específico: `GET /clientes/:id/tabelas-preco`, protegido por `requireAuth`, escopado (vendedor só vê o que tem permissão de ver — reaproveitar `VendedorEscopoService` para confirmar que o vendedor atende aquele cliente antes de listar).

**Critério de aceite:** admin consegue, pelo painel, associar 1+ tabelas a um cliente e restringir quais vendedores veem cada uma; vendedor autenticado só enxerga as tabelas liberadas para ele naquele cliente; cliente com uma única tabela associada não permite seleção (comportamento "fixo").

---

### OS-BACKEND-XX — Endpoint de cálculo de preço por tabela específica (com desconto opcional e margem)

**Contexto:** hoje `ProdutoCalculoService.calcular()` já resolve quantidade+valor a partir da tabela **padrão global** (`PrecoProdutoService.obterPrecoPorCodigo`). O pedido novo quer: (1) permitir informar explicitamente **qual tabela** usar (não só a padrão), (2) aceitar um percentual de desconto opcional, (3) retornar valor final **e margem de lucro**.

**O que fazer:**
- Estender `PrecoProdutoService` com um método que recebe `tabelaPrecoId` (em vez de sempre resolver a tabela selecionada global) — reaproveitar `ItemTabelaPreco` já indexado por `codigoItem`.
- Adicionar `tabelaPrecoId` (opcional — se ausente, cair no fallback definido no Bloco 1, item 3) e `percentualDesconto` (opcional, `number`, validado via `class-validator` com `@Min(0) @Max(100)` ou o teto já usado em `ItemTabelaPreco.percentualDescontoMaximo`/`valorDescontoMaximo` — **⚠️ confirmar se esse cálculo deve respeitar o teto de desconto já cadastrado no item da tabela, ou se é um desconto "livre" nesta simulação específica**) ao DTO de `calcular-quantidade.dto.ts`.
- Cálculo de margem de lucro: `Produto.precoFabricacao` já existe no schema (campo manual, preenchido via `PATCH /produtos/:id`). Margem = `(valorFinalUnitario - precoFabricacao) / valorFinalUnitario` (ou sobre `precoFabricacao`, a confirmar qual base o financeiro usa — **⚠️ confirmar fórmula de margem com o time antes de codar**, evitar cravar a fórmula errada num cálculo que vira referência financeira).
- Se `precoFabricacao` não estiver cadastrado para o produto, retornar `margemLucro: null` explicitamente (nunca inventar valor) e sinalizar no response que a margem não pôde ser calculada.
- Reaproveitar `calcularQuantidadePedido` (domain function já existente) para quantidade — não duplicar essa lógica.

**Critério de aceite:** endpoint aceita `produtoId`, `metrosDesejados`, `tabelaPrecoId` (opcional) e `percentualDesconto` (opcional); retorna quantidade, valor unitário, valor final (com desconto aplicado) e margem de lucro (ou `null` com motivo, se não calculável); testes cobrindo: sem desconto, com desconto, sem `precoFabricacao` cadastrado.

---

### OS-BACKEND-XX — Tela/endpoint de "preço por tabela de preço" (comparativo)

**Contexto:** pedido de "uma tabela onde mostra o preço por tabela de preço" — leitura como: dado um produto (ou lista de produtos), mostrar o preço dele em cada tabela de preço disponível, lado a lado.

**O que fazer:**
- Endpoint `GET /produtos/:id/precos` retornando, para cada `TabelaPreco` ativa (ou só as associadas ao cliente em contexto, se o parâmetro `clienteId` for passado — reaproveitar Bloco 1), o preço daquele produto (`ItemTabelaPreco` por `codigoItem`).
- Escopo de leitura: mesmo critério de `TabelasPrecoController` hoje (`requireAuth`, aberto a qualquer autenticado) — mas se `clienteId` for informado, aplicar o filtro de visibilidade por vendedor do Bloco 1.

**Critério de aceite:** dado um produto, é possível ver seu preço em todas as tabelas às quais o usuário tem acesso, numa única resposta.

---

### OS-WEB/MOBILE-XX — Seletor de tabela de preço ao visualizar preço do produto

**Contexto:** front-end (web e/ou mobile) precisa de um seletor de tabela de preço na tela de produto/pedido, consumindo os endpoints do Bloco 1 (`GET /clientes/:id/tabelas-preco`) e do cálculo (`OS-BACKEND-XX — Endpoint de cálculo de preço por tabela específica`).

**O que fazer:**
- Se o cliente tiver só 1 tabela disponível: não mostrar seletor, aplicar direto (comportamento "fixo").
- Se tiver mais de 1: mostrar seletor com as tabelas liberadas para aquele vendedor naquele cliente; ao trocar, re-consultar o preço/cálculo.
- Persistir a tabela selecionada no estado do pedido em andamento (rascunho local, mobile inclusive offline).

**Critério de aceite:** vendedor com cliente de tabela única nunca vê seletor; vendedor com cliente de múltiplas tabelas escolhe entre as liberadas para ele e o preço exibido/calculado reflete a escolha.

---

## Bloco 2 — Escopo de pedidos por vendedor

### OS-BACKEND-XX — Atualizar a correção do achado crítico (`/pedidos`) para escopo, não só bloqueio

**Contexto:** este pedido refina a OS crítica já aberta anteriormente (`/pedidos` sem `requireRole('admin')`). Antes a correção proposta era simplesmente restringir a rota a admin. O pedido agora deixa explícito que o objetivo é **vendedor ver os próprios pedidos, dos clientes que atende** — não simplesmente bloquear o vendedor.

**O que fazer:**
- Em vez de `requireRole('admin')` puro no `MiddlewareConsumer` de `PedidosModule`, manter `requireAuth` e mover a lógica de escopo para dentro de `PedidosService`, seguindo o mesmo padrão já usado em `VisitasService.listarEquipe`/`RelatorioPedidosService` (reaproveitar `VendedorEscopoService.resolverEscopoClientes`):
  - `admin` → vê todos os pedidos (comportamento atual do painel).
  - `SUPERVISOR`/`GERENTE` → vê pedidos da própria equipe (recursivo, mesmo critério já usado em outros módulos).
  - `VENDEDOR` comum → vê **só** pedidos de clientes vinculados a ele em `ClienteVendedor`.
- Aplicar isso em `listar()`, `buscarPorId()` e `obterHistorico()` — hoje nenhum dos três filtra por escopo.
- Seguir o critério anti-IDOR já padrão no projeto: pedido fora do escopo retorna **404**, não 403 (não revelar que o recurso existe).
- Escrever/atualizar testes de integração cobrindo os três papéis.

**Critério de aceite:** vendedor autenticado só lista/vê pedidos de clientes que atende (via `ClienteVendedor`); supervisor/gerente vê a equipe; admin vê tudo; tentativa de acessar `GET /pedidos/:id` de um pedido fora do escopo retorna 404.

**Nota:** isso substitui/atualiza a OS crítica gerada anteriormente — ao implementar, marcar a OS antiga como superada por esta.

---

### OS-BACKEND-XX — Verificação de necessidade de checagem por role em `POST /pedidos`

**Contexto:** pedido explícito para verificar se `POST /pedidos` precisa de checagem adicional por role, já que as 3 roles de negócio (admin, supervisor, vendedor) podem criar pedido.

**Análise do estado atual (para o Claude Code confirmar, não re-derivar do zero):** `PedidosController.criar()` já resolve `VendedorEscopoService.resolverEscopoClientes(idpUser, usuario.id)` antes de chamar `CriarPedidoService.criar()`, e esse escopo já é diferente por role (admin = todos os clientes, supervisor/gerente = equipe, vendedor = próprio). Ou seja, a autorização de **para qual cliente** um pedido pode ser criado já é resolvida por escopo, não por um guard de role explícito — o mesmo padrão usado no resto do projeto (ver skill `security-review`, item 2: decisão de autorização não deve depender de checagem redundante no controller se o service já aplica escopo corretamente).

**O que fazer:**
- Confirmar em teste de integração que: vendedor comum só consegue criar pedido para cliente da própria carteira (`ClienteVendedor`); supervisor/gerente só para clientes da equipe; admin para qualquer cliente. Se esses três casos já passam, **não é necessário adicionar `requireRole` explícito** neste endpoint — a checagem de escopo já cumpre o papel de autorização.
- Se o teste revelar algum caso onde o escopo não é aplicado corretamente (ex: `vendedorId` do pedido sendo aceito do body em vez de derivado de `req.user`), corrigir isso especificamente — não adicionar um guard de role como substituto de corrigir o escopo.

**Critério de aceite:** suíte de teste cobrindo os 3 papéis criando pedido, confirmando que nenhum consegue criar pedido para cliente fora do próprio escopo; decisão documentada no código (comentário) de por que não há `requireRole` explícito aqui, apontando para o escopo como mecanismo de autorização.

---
 
## Bloco 3 — Peso líquido/bruto e novos campos de produto

### Estado atual

`Produto` é sincronizado de `GET /api/empresarial/v1/produto` (WK Radar) — ver `src/sync/strategies/produto.sync.ts` e `src/sync/strategies/produto.types.ts` para o mapeamento de campos hoje feito. `comprimentoMetros` e `tipoVenda` já existem como precedente de "campo calculado a partir do produto sincronizado + regra local".

### ⚠️ Decisões necessárias antes de codar

1. **Peso líquido e bruto vêm do WK Radar ou são campo manual?** O pedido diz "adicionar peso líquido e bruto aos produtos (endpoint de produtos .../produto)", o que sugere que esses campos **já existem na resposta do WK Radar** e só não foram mapeados ainda. Antes de codar, o Claude Code deve inspecionar o payload real de `GET /api/empresarial/v1/produto` (ou o swagger já importado, ver `admin-endpoints/swagger-import.service.ts`) para confirmar o nome exato dos campos (prováveis candidatos: `dimensoes.pesoLiquido`/`dimensoes.pesoBruto`, mesma seção de onde vem `comprimento`). Se não vierem do Radar, viram campo manual (`PATCH /produtos/:id`, mesmo padrão de `precoFabricacao`).
2. **Unidade do peso por produto** (o exemplo do pedido usa "kg por km" — ou seja, peso é por unidade de comprimento, não peso total do produto cadastrado). Confirmar se o campo a mapear é "peso por metro/km" (multiplicado pela quantidade pedida) ou "peso da unidade de venda" — a fórmula de soma no pedido depende dessa definição.

**O que fazer:**
- Migration adicionando `pesoLiquidoPorMetro` e `pesoBrutoPorMetro` (nomes a ajustar conforme decisão acima) em `Produto`, `Decimal`, nullable (mesmo padrão de `comprimentoMetros`).
- Se vier do Radar: mapear em `produto.sync.ts`/`produto.types.ts`, seguindo o padrão já usado para `comprimentoMetros` (fail-safe: null se a unidade não for a esperada, nunca interpretar valor errado).
- Se for manual: expor em `PATCH /produtos/:id` (endpoint admin já existente), mesmo padrão de `precoFabricacao`.

---

### OS-BACKEND-XX — Somar peso líquido/bruto total do pedido

**Contexto:** dado o exemplo do pedido (`0.2km de X (1000kg/km) + 0.1km de Y (900kg/km) = 200kg + 90kg = 290kg`), o cálculo é: para cada item do pedido, `pesoPorMetro * quantidadeEmMetros`, somado entre todos os itens.

**O que fazer:**
- Adicionar cálculo de peso total (líquido e bruto) em `CriarPedidoService`/`PedidosService`, reaproveitando `PedidoItem.quantidadeVenda` e o `pesoLiquidoPorMetro`/`pesoBrutoPorMetro` do produto de cada item.
- Expor esses dois totais no DTO de resposta do pedido (`PedidoDetalheDto`/`PedidoResumoDto`, a confirmar em qual dos dois faz sentido aparecer).
- **⚠️ Confirmar se o peso deve ser calculado e armazenado no momento da criação do pedido (congelado, como `valorTotal` já é) ou calculado sob demanda a cada leitura** — mesmo tipo de decisão já tomada para preço (`valorTotal` é persistido, não recalculado a cada GET). Seguir o mesmo padrão por consistência, a menos que haja razão para diferente.

**Critério de aceite:** resposta de um pedido traz peso líquido e bruto total, calculado corretamente a partir dos itens e das quantidades pedidas, batendo com o exemplo do pedido original (290kg no cenário dado).

---

## Bloco 4 — Tipo de acondicionamento e tamanho fixo

### OS-BACKEND-XX — Cadastro extensível de "tipo de acondicionamento"

**Contexto:** pedido de um campo em `Produto` com "possibilidade de cadastrar novos tipos" — ou seja, não é um enum fixo (como `TipoVendaProduto`), é um catálogo editável pelo admin.

**O que fazer:**
- Novo modelo `TipoAcondicionamento` (`id`, `nome`, `ativo`, timestamps) — catálogo simples, não sincronizado do Radar (dado próprio do sistema).
- `Produto.tipoAcondicionamentoId` (nullable, FK) — campo manual, mesmo padrão de `precoFabricacao`/`imagemCaminho` (fora do mapeamento de sync, editável via `PATCH /produtos/:id`).
- Endpoints admin: `GET/POST/PATCH /admin/tipos-acondicionamento` (CRUD simples, `requireRole('admin')`), e `GET /tipos-acondicionamento` (leitura, `requireAuth`, para popular seletor no front).

**Critério de aceite:** admin cadastra novos tipos de acondicionamento pelo painel sem precisar de deploy; produto pode ser associado a um tipo existente via `PATCH /produtos/:id`.

---

### OS-BACKEND-XX — Tamanho padrão / bloqueio de quantidade inválida

**Contexto — atenção, isso já existe parcialmente:** o código atual (`calcularQuantidadePedido`, ver `domain/calculo-quantidade-pedido.ts`) já implementa exatamente a distinção "retalho = fracionário" vs "não-retalho = tamanho fixo, calculado por múltiplo ou unidade":
- `RET` (retalho): aceita qualquer valor fracionário — já é o comportamento pedido ("tamanho não fixo").
- `KM`: já **bloqueia** e informa erro claro se a quantidade pedida não fechar em múltiplo exato do `comprimentoMetros` do produto — já é exatamente o comportamento pedido ("impedir e informar o valor correto"), embora a mensagem de erro hoje informe o múltiplo esperado, não sugira o valor mais próximo já calculado.
- `POC`: hoje **arredonda automaticamente** para a peça inteira mais próxima, em vez de bloquear — isso **diverge** do que foi pedido agora ("impedir e informar o valor correto").

### ⚠️ Decisão necessária antes de codar

O comportamento de `POC` precisa mudar de "arredonda automaticamente" para "bloqueia e informa o valor correto múltiplo mais próximo"? Isso é uma mudança de comportamento em lógica já testada e em produção (`calculo-quantidade-pedido.ts` tem regra explícita e comentada dizendo "arredonda, não erro, diferente de KM" — decisão que já foi tomada uma vez antes). Confirmar com o time se essa OS está pedindo para **reverter** essa decisão anterior (unificando POC com o comportamento de KM: sempre bloquear) antes de alterar — não mudar silenciosamente um comportamento que foi decisão deliberada documentada no código.

**O que fazer (assumindo confirmação de que POC deve passar a bloquear, igual KM):**
- Unificar `POC` e `KM` em `calcularQuantidadePedido` para o mesmo comportamento de bloqueio com mensagem de erro, incluindo no erro o valor múltiplo mais próximo (`Math.round(divisao) * comprimentoMetros`) para o vendedor corrigir rapidamente — hoje a mensagem de erro do `KM` já cita o `comprimentoMetros`, mas pode ficar mais explícita citando o valor exato mais próximo já calculado.
- Atualizar testes existentes de `calculo-quantidade-pedido.spec.ts`/equivalente que hoje validam o arredondamento automático de POC — eles vão precisar mudar de expectativa.
- Confirmar que `tipoAcondicionamento`/"tudo que não for retalho" realmente mapeia 1:1 para "todo tipoVenda != RET", ou se existe caso de RET com tamanho fixo, ou não-RET com tamanho livre, que quebraria essa generalização.

**Critério de aceite:** pedido com quantidade que não fecha em múltiplo exato do tamanho padrão do produto (POC ou KM) é bloqueado, com mensagem informando o valor correto mais próximo; retalho (RET) continua aceitando qualquer valor.

---

## Bloco 5 — Check-in sem agendamento de visita

### ⚠️ Decisão necessária antes de codar (bloqueante)

Não existe hoje, em nenhum lugar do backend, um modelo de **agendamento prévio de visita** — `Visita` (ver schema) só registra check-in/checkout, sem relação com uma visita previamente agendada. Não há tabela `AgendamentoVisita` nem campo equivalente.

Isso significa que o pedido "permitir check-in sem agendamento (e a opção no painel web para permitir isso)" pressupõe uma feature de agendamento que **ainda não existe no código**. Antes de qualquer implementação, confirmar com o time:
1. O agendamento de visita é uma feature nova a ser construída **junto** com esta OS (ou seja, essa OS na verdade pede duas coisas: criar agendamento + criar a exceção de check-in sem agendamento)? Ou
2. O agendamento já existe em algum lugar fora deste repositório (outro sistema, planilha, processo manual) e a intenção aqui é só preparar o backend para, no futuro, exigir agendamento por padrão, com uma configuração que hoje já nasce "permitir sem agendamento = true"?

**Não prosseguir com implementação de código antes dessa resposta** — implementar a exceção de uma regra que ainda não existe (obrigatoriedade de agendamento) não tem como ter critério de aceite verificável.

### OS-BACKEND/WEB-XX — (a confirmar escopo conforme decisão acima) Configuração "permitir visita sem agendamento"

**Esqueleto de implementação, assumindo que a opção 1 acima for confirmada (agendamento é feature nova):**
- Novo modelo `AgendamentoVisita` (`clienteId`, `vendedorId`, `dataHoraPrevista`, `criadoPor`, timestamps).
- Novo campo de configuração — por empresa ou por vendedor, a confirmar — ex. `Vendedor.permiteCheckinSemAgendamento` (boolean, default a definir) ou uma configuração singleton nova (mesmo padrão de `ConfiguracaoTabelaPreco`), editável via painel admin (`requireRole('admin')`).
- `VisitasService.checkin()` passa a validar: se existe agendamento para aquele cliente/vendedor no período esperado, ok; se não existe **e** a configuração de "permitir sem agendamento" está desligada para aquele vendedor, bloquear o check-in com mensagem clara.
- Tela admin com toggle por vendedor (ou global, conforme decisão) para permitir check-in avulso.

**Critério de aceite:** com a opção desligada, vendedor só consegue check-in em cliente com agendamento prévio; com a opção ligada (por vendedor), check-in funciona normalmente sem agendamento, igual ao comportamento atual do sistema.

---

## Resumo

| Bloco | Item | Status para o Claude Code |
|---|---|---|
| 1 | Tabela de preço por cliente/vendedor (schema + endpoints) | ⚠️ Aguarda decisões 1–4 antes de codar |
| 1 | Endpoint de cálculo por tabela específica + desconto + margem | ⚠️ Aguarda fórmula de margem e regra de teto de desconto |
| 1 | Comparativo de preço por tabela | Pode implementar após Bloco 1 base existir |
| 1 | Seletor de tabela no front (web/mobile) | Depende dos endpoints acima |
| 2 | Escopo de `/pedidos` por vendedor (atualiza OS crítica anterior) | Pronto para implementar |
| 2 | Verificação de role em `POST /pedidos` | Pronto para implementar (é validação/teste, não mudança de comportamento esperada) |
| 3 | Peso líquido/bruto em produto + soma no pedido | ⚠️ Aguarda confirmação se vem do Radar e unidade exata |
| 4 | Tipo de acondicionamento (catálogo extensível) | Pronto para implementar |
| 4 | Bloqueio de tamanho fixo (POC) | ⚠️ Aguarda confirmação — muda comportamento já decidido antes |
| 5 | Check-in sem agendamento | 🔴 Bloqueado — depende de decisão sobre existir ou não feature de agendamento |
