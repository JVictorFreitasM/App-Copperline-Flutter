# Casos de uso de IA no App Copperline (OS-BACKEND-40)

Documento de análise, não de implementação. Mapeia onde IA (LLM) já está
aplicada no sistema hoje, onde uma aplicação nova teria dado real suficiente
pra funcionar, e onde a ideia só faria sentido com dado que não é
sincronizado atualmente. Escrito a partir da leitura do código em
`backend/src/llm-client`, `backend/src/clientes`, `backend/src/produtos` e do
`schema.prisma` (única fonte de verdade sobre o que está persistido hoje).

Critério de corte usado em todo o documento, já adotado no projeto (ver
comentário em `produtos-ruptura.service.ts`): **IA só entra onde uma regra
determinística não resolve igual ou melhor.** Ruptura de estoque, por
exemplo, é aritmética sobre `SaldoEstoque` e `PedidoItem` — testável,
reproduzível, sem custo de API e sem risco de alucinação. Trocar isso por um
LLM seria piora, não avanço. O mesmo raciocínio se aplica às sugestões
abaixo: cada uma foi checada contra "isso é uma regra, ou precisa
interpretar/gerar linguagem/lidar com ambiguidade de verdade?".

---

## 1. Já implementado

### 1.1 Resumo de cliente via LLM (OS-BACKEND-20)

`backend/src/clientes/cliente-resumo-llm.service.ts`, endpoint por trás de
`ClienteResumoLlmService.obterResumo`.

O que faz: antes de uma visita, gera um resumo objetivo do cliente
(`pontosDeAtencao[]`, `sugestaoAbordagem`, `dadosInsuficientes`) a partir dos
10 pedidos mais recentes, notas fiscais pendentes/rejeitadas e ticket médio
— todos lidos direto do Postgres (`Pedido`, `NotaFiscal`, agregação de
`valorTotal`), nada inventado fora disso.

Garantias contra alucinação:
- **System prompt restritivo**: instrui explicitamente a usar só o que foi
  passado no JSON e a nunca inferir dado ausente (nome de produto, motivo de
  rejeição, histórico não mencionado).
- **Válvula de escape**: campo `dadosInsuficientes: boolean` — o modelo tem
  como dizer "não dá pra concluir nada útil" em vez de forçar uma resposta.
- **Validação estrutural**: `LlmClientService.gerarJson` faz `schema.safeParse`
  (Zod) sobre a resposta antes de devolver qualquer coisa ao chamador. JSON
  fora do formato esperado nunca chega ao consumidor — é erro, não
  repasse silencioso.
- **Cache de 24h no Redis** (`cache:resumo-cliente:<id>`) — decisão de custo,
  não de acurácia: gerar de novo a cada abertura de tela seria caro e lento.

Status atual: **implementado e funcional no código, mas sem chave de API
configurada em produção.** `LlmClientService.gerarJson` falha fail-closed
(`Nenhuma chave de API de LLM configurada...`) se `ConfiguracaoLlm.apiKey`
estiver nula — que é o estado hoje (linha singleton criada com
`apiKey: null` por padrão, sem seed). A configuração é feita em runtime via
`PATCH /admin/llm/configuracao`, atrás de `ApiKeyGuard` — não é um deploy
pendente, é uma decisão operacional pendente (alguém configurar a chave do
OpenRouter). Confirmado também no backlog (OS-pendentes-claude-code.md):
"já implementado no backend — só falta chave de API".

Provedor: OpenRouter (`https://openrouter.ai/api/v1/chat/completions`),
gateway compatível com o formato de chat completions da OpenAI — troca de
modelo (`anthropic/claude-opus-5`, `openai/gpt-5`, etc.) é só o campo
`model` no body, sem trocar de SDK. Modelo default configurado:
`anthropic/claude-opus-5`.

### 1.2 Previsão de ruptura de estoque (OS-BACKEND-20)

`backend/src/produtos/produtos-ruptura.service.ts`,
`ProdutosRupturaService.calcular`.

**Deliberadamente não é LLM.** É regra estatística determinística: consumo
diário médio dos últimos 30 dias (`PedidoItem.quantidadeVenda`, excluindo
cancelados) contra saldo disponível (`SaldoEstoque.quantidadeDisponivel`,
casado por `codigoProduto`), projetando dias até zerar. Produto sem consumo
recente não entra na lista — indeterminado não é o mesmo que "vai zerar",
e o serviço não força uma conclusão sem base numérica.

Por que não LLM, por design (comentário no próprio código): "mais confiável
que pedir 'previsão' a um LLM sem contexto numérico robusto". É também
testável sem chamada externa — critério de aceite explícito da OS original.
Esse é o padrão de referência para qualquer outra ideia de "previsão" que
surgir no sistema: se o dado é numérico e a relação é aritmética, a resposta
é regra, não modelo de linguagem.

Status: ativo, sem dependência de chave de API — não é afetado pela pendência
da seção 1.1.

---

## 2. Avaliação por módulo

### 2.1 Cliente

Dado disponível hoje: cadastro (`Cliente` — razão social, CNPJ, endereços,
limite de crédito), vínculo com vendedor (`ClienteVendedor`), pin de
geolocalização definido manualmente, histórico completo de `Pedido` e
`NotaFiscal` relacionados. Dado financeiro em aberto (`título a receber`) é
consultado sob demanda em `ClienteFinanceiroService` contra a API do WK
Radar, **não persistido localmente** — é transacional, muda a cada
pagamento.

- **(1) Já implementado**: resumo pré-visita (seção 1.1).
- **(2) Viável com o dado atual**: nada adicional com valor claro. Um
  "score de propensão de compra" ou "risco de churn" via LLM seria
  especulação em cima de poucos meses de histórico sincronizado — sem base
  estatística real, isso é o tipo de promessa que o critério de aceite desta
  OS pede pra evitar.
- **(3) Precisaria de dado adicional**: qualquer classificação de risco de
  crédito precisaria de série histórica financeira persistida (hoje é
  consulta pontual, sem retenção) — sem isso não há o que treinar/avaliar,
  LLM ou não.

### 2.2 Pedido

Dado disponível: situação (`TipoSituacaoPedido`), histórico de transição de
status (`PedidoHistoricoStatus`), itens, valor, desconto solicitado
(`SolicitacaoDesconto`).

- **(1) Já implementado**: nenhum uso de LLM neste módulo. A decisão de
  aprovação de desconto (`ConfiguracaoDesconto.limitePercentual`) já é regra
  determinística — correto, é uma comparação numérica configurável, não algo
  que precise de linguagem natural.
- **(2) Viável com o dado atual, mas como regra, não LLM**: alerta de
  "pedido parado" (tempo excessivo em `EM_ANALISE`/`BLOQUEADO`,
  usando `PedidoHistoricoStatus`) é só uma consulta com filtro de tempo.
  Aplicar LLM aqui seria o mesmo erro de design que a OS-BACKEND-20 evitou em
  ruptura de estoque — não incluir na lista de próximos passos como "caso de
  IA".
- **(3) Precisaria de dado adicional**: nenhuma ideia de IA identificada
  aqui teria valor sem dado que já não seja mais bem servido por regra.

### 2.3 Estoque

Dado disponível: `SaldoEstoque` (só Estoque Próprio, sem quebra por filial —
decisão de escopo já tomada), sem histórico de série temporal persistido
(cada sync sobrescreve o saldo atual, não acumula pontos).

- **(1) Já implementado**: ruptura prevista (seção 1.2).
- **(2) Viável com o dado atual**: nenhuma extensão de IA — a mesma lógica
  de "é aritmética, não precisa de modelo" se aplica a qualquer variação
  (ex: sugestão de quantidade de reposição também seria fórmula, não LLM).
- **(3) Precisaria de dado adicional**: uma previsão de demanda mais
  sofisticada (sazonalidade, tendência) precisaria de série histórica de
  saldo ao longo do tempo, que hoje não é retida (`SaldoEstoque` é upsert de
  1 linha por produto, sem log de variação) — e mesmo com esse dado, o
  primeiro candidato continua sendo um modelo estatístico simples (média
  móvel, regressão), não um LLM.

### 2.4 Visita

Dado disponível: check-in/checkout com geolocalização e distância calculada
(`Visita.distanciaCheckinMetros`/`distanciaCheckoutMetros`), foto obrigatória
da fachada no check-in, nota livre em texto.

- **(1) Já implementado**: nada.
- **(2) Viável com o dado atual**: resumo de notas de visita de um cliente
  ao longo do tempo (texto livre, múltiplas visitas) via LLM, no mesmo
  padrão anti-alucinação de `ClienteResumoLlmService` (usar só o texto
  presente, sinalizar quando não há nota suficiente). Isso é conteúdo em
  linguagem natural de verdade — diferente de ruptura/pedido, aqui a tarefa
  é sintetizar texto não estruturado, o caso de uso onde LLM tem vantagem
  real sobre regra.
- **(3) Precisaria de dado adicional**: verificação automática (visão
  computacional) de que a foto do check-in realmente mostra a fachada do
  cliente esperado exigiria um modelo de visão e, mais importante, um
  conjunto de fotos rotuladas pra validar a taxa de erro antes de confiar
  nisso operacionalmente — nenhum dos dois existe hoje. Não recomendado
  como próximo passo sem esse dado de validação.

### 2.5 Rastreio

Dado disponível: pontos de localização em lote (`LocalizacaoUsuario` —
latitude/longitude/timestamp capturado no dispositivo), sem tempo real (é
processado em lote, inclusive após período offline).

- **(1) Já implementado**: nada.
- **(2) Viável com o dado atual, mas como regra, não LLM**: detecção de
  desvio de rota ou tempo parado excessivo é cálculo geográfico
  (distância/velocidade entre pontos consecutivos) — mesma lógica já usada
  em `distancia-geografica.ts` para validar check-in/checkout. Não é caso de
  IA.
- **(3) Precisaria de dado adicional**: nenhum caso de IA de valor
  identificado aqui — o dado é de baixa dimensionalidade (coordenadas), o
  que naturalmente favorece regra sobre modelo.

### 2.6 Notas fiscais

Dado disponível: status (`StatusNfe` — enum: erro de validação, aguardando
autorização, autorizada, denegada, rejeitada, cancelada, inutilizada),
número, série, data de emissão, valor total, vínculo com pedido(s). **Não há
campo de motivo/descrição textual da rejeição persistido** — o schema atual
(`NotaFiscal`) guarda só o status categórico; blocos fiscais detalhados por
item foram deliberadamente deixados fora do mapeamento na sincronização
original (OS 09), por não serem necessários até agora.

- **(1) Já implementado**: nada.
- **(2) Viável com o dado atual**: nada de IA — com só o enum de status,
  qualquer classificação seria sobre um conjunto fechado de valores já
  conhecidos, o que é um `switch`, não um modelo.
- **(3) Precisaria de dado adicional**: um resumo ou categorização
  inteligente do **motivo** de rejeição/erro de validação (útil de verdade
  para o vendedor entender "por que essa nota travou") só faria sentido se o
  texto de motivo do WK Radar for mapeado para o Postgres primeiro — hoje
  esse campo não está no schema. Isso é um pré-requisito de sincronização,
  não uma tarefa de IA em si; documentar aqui para não prometer o resumo
  antes do dado existir.

---

## 3. Onde deliberadamente não aplicar IA

Resumo dos casos acima onde a IA foi considerada e descartada em favor de
regra determinística — importante deixar explícito para não reabrir a
discussão sem novidade de dado:

- Ruptura de estoque (já é regra, ver 1.2).
- Pedido parado / alerta de tempo em análise (é filtro de data).
- Desvio de rota / tempo parado em rastreio (é geometria).
- Qualquer "previsão de demanda" sem série histórica de estoque persistida
  (falta dado, e mesmo com dado o primeiro candidato é modelo estatístico
  simples, não LLM).

Princípio geral (consistente com o CLAUDE.md do projeto: nunca fabricar
dado): toda sugestão de IA neste documento que dependa de dado não
sincronizado foi marcada como categoria 3 e não como algo "quase pronto" —
implementar o mapeamento desse dado é um passo de sincronização com ERP
separado, com sua própria OS, antes de qualquer trabalho de IA em cima dele.

---

## 4. Resumo executivo

| Módulo | Já implementado | Viável hoje (dado real) | Precisa dado adicional |
|---|---|---|---|
| Cliente | Resumo pré-visita (LLM, aguardando chave) | — | Score de crédito (falta histórico financeiro persistido) |
| Pedido | — | Alerta de pedido parado (regra, não IA) | — |
| Estoque | Ruptura prevista (regra estatística) | — | Previsão de demanda com sazonalidade (falta série histórica) |
| Visita | — | Resumo de notas de visita (LLM) | Verificação de foto por visão computacional (falta dado rotulado) |
| Rastreio | — | Desvio de rota (regra, não IA) | — |
| Notas fiscais | — | — | Resumo de motivo de rejeição (falta campo sincronizado) |
