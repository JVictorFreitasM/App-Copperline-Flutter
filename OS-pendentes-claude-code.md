# OS Pendentes — App Copperline

Documento consolidado das pendências REAIS do projeto. Reescrito em
2026-09-14 após auditoria completa contra o código atual — a versão
anterior estava muito desatualizada (22 de 24 itens auditados já haviam
sido implementados em rodadas anteriores sem o documento ser atualizado).
Antes de assumir algo como pendente, sempre conferir o código/`git log`
primeiro.

---

## 🔴 Bloqueios que não são tarefa de código

Não iniciar até resolvido — são decisões de negócio, não bugs:

- **Classificação POC/RET/KM do produto** (`Produto.tipoVenda`): campo
  nunca foi preenchido automaticamente — origem/regra de classificação
  (nativo do Radar vs. inferido a partir do comprimento) nunca foi
  confirmada com o gestor. **Parcialmente contornado**: o bloqueio de
  quantidade por tamanho fixo (OS-novas-implementacoes.md Bloco 4) foi
  redesenhado para usar `TipoAcondicionamento.tamanhoPadrao` (cadastro
  manual do admin) em vez de `tipoVenda`, então a funcionalidade de
  pedido já funciona sem essa classificação automática. O campo
  `tipoVenda` em si continua sem uso real, mantido só por
  retrocompatibilidade de API.
- **Envio de pedido ao ERP** (`PedidoErpClientService`): aguardando 6 IDs
  fixos de referência do Radar (`idFilial`, `idOperacaoComercial`,
  `idNaturezaOperacao`, `idTabelaPreco`, `idUnidadeVenda`,
  `idCondicaoPagamento`) — confirmados como valores fixos da empresa, mas
  nunca fornecidos. Fail-closed até chegarem (nunca hardcodar valor de
  exemplo). Bloqueia em cascata: criação de pedido no app mobile,
  "repetir pedido anterior" (sugestão de IA), assinatura digital de
  pedido, e faz qualquer pedido criado no web (`/pedidos/novo`) cujo
  desconto não precise de aprovação falhar no envio real (só o caminho
  com aprovação de desconto funciona ponta a ponta hoje).
- **PDF/XML de nota fiscal** (`BuscarTokenPDFNFe`/`DownloadPDFNFe`,
  `BuscarTokenXMLNotas`/`DownloadXMLNFeNFSe`) e **simulação de pedido via
  `EfetuarPreCalculoPedido`**: precisam do WSDL de `Comercial.svc`, ainda
  não fornecido (só o de `Financeiro.svc` foi, usado no boleto). Regra do
  projeto: nunca adivinhar shape de SOAP sem o WSDL real.

---

## Pendente — Backend

### Job diário de relatório de pedidos (notificação push)

`GET /pedidos/relatorio` já existe e já inclui pendentes de dias
anteriores, mas falta o **job agendado diário** que monta esse relatório
por vendedor e dispara a notificação push com o resumo (quantidade
total, quantos pendentes). Sem isso, o app mobile também não tem o que
mostrar na tela de relatório diário nem categoria de notificação
correspondente.

### Rate limiting em mais rotas sensíveis (parcial)

Aplicado só em `GET /clientes/:id/resumo` (chamada LLM paga). Faltam
outros candidatos: `POST /pedidos/simular-desconto`,
`POST /admin/endpoints/importar-swagger`. Confirmar também com o time do
IdP central se há rate limit em tentativas de login/OTP.

### Aviso de simulação de desconto não reserva nada

Nem web nem mobile têm hoje uma tela que consuma
`POST /pedidos/simular-desconto`. Reavaliar se essa tela ainda está no
roadmap antes de tratar como pendência de verdade; se não estiver, fechar
como não-aplicável.

### Girar credenciais do `.env`

Precisa de coordenação com quem administra o WK Radar — rotacionar sem
avisar quebra a sincronização em produção.

### Checklist de deploy (API key / cookie domain)

Confirmar em produção: `NODE_ENV=production` setado corretamente (pra
`cookie.secure` funcionar) e `SESSION_COOKIE_DOMAIN` correta — ver skill
`idp-client`.

### Log de auditoria de acesso administrativo

Registrar quem acessou qual recurso sensível e quando (reforça a defesa
contra IDOR já corrigido em `/pedidos`).

### Row Level Security nativo (Pedido/Cliente/SolicitacaoDesconto)

Precisa de POC em staging medindo impacto de performance antes de
decidir viabilidade.

### Exportação agendada de relatórios de pedidos

O campo `escopo` já existe no relatório e serve de base pra isso quando
for priorizado.

### Status de cobrança por pedido (listagem `/pedidos`)

`Financeiro.svc` só tem busca individual por cliente (sem endpoint em
lote) — um filtro na listagem exigiria 1 chamada SOAP por cliente
distinto da página. Decisão: fica de fora da listagem por ora; deve
aparecer na tela de pedido individual quando o layout dela for definido.

### Categoria / Tipo de Pedido (listagem `/pedidos`)

Sem fonte de dado no Radar — exigiriam sincronizar catálogos novos
(Natureza de Operação/Operação Comercial). Coluna "Tipo de Pedido" na
tabela mostra sempre "Venda" (fixo, único tipo que o sistema cria hoje),
sem filtro correspondente.

### Imprimir lista / Exportar Excel / Alterar status em lote (listagem `/pedidos`)

Adiados por decisão explícita do usuário ("só filtros e tabela
primeiro").

### Fórmula de margem de lucro (cálculo de preço por tabela)

Endpoint de cálculo por tabela específica retorna `margemLucro: null`
sempre — pendente confirmar se a fórmula é `(valorFinal -
precoFabricacao) / valorFinal` (margem sobre venda) ou `(valorFinal -
precoFabricacao) / precoFabricacao` (markup sobre custo). Nunca inventar
a fórmula.

---

## Pendente — Web

Nenhum item de tela pendente identificado na última auditoria além dos
já listados acima (status de cobrança/categoria/tipo de pedido na
listagem de pedidos).

### Campos da tela de detalhe do pedido sem dado real no backend (2026-09-15)

Tela `/pedidos/:id` (layout de referência `ref1.jpeg`) foi implementada
mostrando só o que existe hoje — os campos abaixo aparecem como "—" na UI,
nunca inventados, porque não têm fonte de dado nenhuma no modelo atual:

- **Origem de venda**: sem campo equivalente em `Pedido`.
- **Horário do envio**: não existe um timestamp de "quando o pedido foi
  enviado" no modelo — `dataHoraUltimaAlteracao`/`sincronizadoEm` têm
  semântica diferente, não reaproveitados aqui pra não inventar sentido.
- **Tabela de preços utilizada no pedido**: `Pedido`/`PedidoItem` não
  guardam qual `TabelaPreco` foi usada no momento da venda (o sistema só
  sabe qual tabela está configurada *hoje*, via `ConfiguracaoTabelaPreco`/
  `ClienteTabelaPreco` — não o que valia quando o pedido sincronizado foi
  fechado no Radar).
- **Forma de pagamento / Condição de pagamento**: o WK Radar expõe
  `faturamento.idFormaPagamento`/`idCondicaoPagamento` no pedido, mas
  nenhum dos dois é sincronizado/mapeado hoje (ver skill
  `wk-radar-client`, `CAMPOS_PEDIDO` em `pedido.sync.ts`).
- **Preço de tabela por item / desconto adicional por item**: `PedidoItem`
  guarda só `valorUnitario`/`valorTotal` finais — não o preço de tabela
  original nem o percentual de desconto aplicado item a item (o Radar
  também não expõe isso rateado por item, só o desconto agregado do
  pedido em `total.valorDescontoProdutos`, não mapeado).
- **% Margem (por item e por pedido)**: mesma pendência já registrada
  acima ("Fórmula de margem de lucro") — a fórmula
  `(valorFinal - precoFabricacao) / valorFinal` vs. `/precoFabricacao`
  nunca foi confirmada, então nenhum número de margem é calculado/exibido
  na tela de detalhe.
- **Observações do vendedor**: campo de texto livre por pedido não existe
  no schema — a caixa aparece desabilitada na UI ("Nenhuma observação"),
  sem persistir nada ainda.
- **Pagamento (De/Por + % desconto)**: só é exibido quando o pedido foi
  criado localmente (`Pedido.percentualDescontoSolicitado` preenchido,
  ver `CriarPedidoService`) — pedido sincronizado do Radar não tem esse
  valor no nosso banco (mesma pendência de forma/condição de pagamento
  acima: o Radar não expõe desconto rateado, só o total já líquido).

### Aprovação granular por item (implementada, revisar decisão de escopo)

`PedidoItem.statusAprovacao` (novo, migration `pedido_item_aprovacao`) é
um conceito **distinto** de `SolicitacaoDesconto` — decide item por item,
sem checar hierarquia (`PapelVendedor`) nem bloquear autoaprovação, ao
contrário do fluxo de `/aprovacoes`. Qualquer usuário com escopo sobre o
pedido pode aprovar/rejeitar item por item ou usar "Aprovar tudo"/
"Reprovar tudo". Decisão tomada durante a implementação por não haver
regra de negócio mais específica pedida — revisar se deveria, no futuro,
exigir o mesmo papel/hierarquia de `SolicitacaoDesconto`, ou se os dois
fluxos devem ficar combinados (hoje "Aprovar tudo" não decide a
`SolicitacaoDesconto` do pedido, são ações independentes).

---

## Pendente — Mobile

### Criação de pedido no app (bloqueado)

Depende dos 6 IDs de referência do Radar (ver bloqueio no topo). Escopo
já definido: selecionar cliente da própria carteira → adicionar produtos
→ campo adaptado ao tipo de acondicionamento, chamando
`POST /produtos/:id/calcular` em tempo real → aviso visível quando
desconto ultrapassa o limite configurado. Pedido criado offline entraria
na fila já existente (`TipoAcaoFila.criarPedido` já existe no enum só
por paridade, nunca é enfileirado hoje).

### Validação ponta a ponta do push do Firebase (roteiro de teste manual)

Não é código novo — precisa de dispositivo físico Android para testar:
foreground/background/app fechado, renovação de token, dispositivo sem
Google Play Services. Reportar qualquer cenário que falhar como bug
específico, não corrigir dentro desta tarefa.

### Configuração do app para acesso fora da rede interna

Bloqueado — confirmado com o usuário que o túnel Cloudflare (domínio
público do backend) ainda não está configurado no servidor. Sem isso,
trocar a URL base do app não tem para onde apontar.

### Atualização OTA via Shorebird

Decisão de adotar já confirmada, CLI instalado e empacotado. Falta o
usuário criar uma API key em https://console.shorebird.dev (Account →
API Keys) e enviá-la — o resto (`SHOREBIRD_TOKEN`, `shorebird init`,
wiring no release) não precisa de mais nenhuma ação manual depois disso.

### Auto-limpeza de cache local de rota de rastreio

Bloqueado por decisão do usuário: a OS pede limpeza automática de um
cache de trajeto que não existe no app — o mobile só *envia* pontos de
rastreio, nunca exibe trajeto de volta (isso só existe no painel web).
Sem base pra implementar sem antes construir uma tela de trajeto no
mobile que não foi pedida — decisão foi não inventar essa tela só pra ter
o que limpar.

### Indicador de sync pendente para pedido criado offline

Mesmo bloqueio de fundo da criação de pedido no app — sem tela de criar
pedido, `TipoAcaoFila.criarPedido` nunca é usado.

### Itens de layout sem dado real no backend

- **Barra de progresso de visitas (home)**: precisa de endpoint "visitas
  planejadas vs. realizadas" (roteiro/meta) que não existe.
- **Chips de filtro "Todos"/"Com pedido"/"Sem visita" + botão "Ver todos
  os clientes"**: `GET /clientes` hoje só aceita `nome`/`cpfCnpj`, falta
  parâmetro/contagem agregada nova. Botão "Ver todos" precisa de decisão:
  redundante com paginação já existente, ou carteira completa da empresa
  (implicação de permissão/escopo)?
- **"Resultado do dia"/"Acima da meta"/"Meta diária" no relatório**: só
  existe meta MENSAL por vendedor hoje (`GET /vendedores/:id/meta-progresso`,
  já consumida na home). Meta/roteiro DIÁRIO é conceito que ainda não
  existe no backend — decisão necessária antes de implementar.

Nenhum desses três deve ser implementado com número inventado/decorativo.

### Certificate pinning (mobile)

Precisa de processo de rotação de certificado acordado com o time de
infra antes de habilitar em produção (senão trava o app quando o
certificado do backend for renovado).
