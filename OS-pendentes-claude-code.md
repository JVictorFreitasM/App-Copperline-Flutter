# OS Pendentes — App Copperline

Documento consolidado para execução via Claude Code. Status confirmado até o momento da geração:
- **Backend**: todas as OS anteriores concluídas, exceto os bloqueios explícitos marcados abaixo.
- **Web**: concluído até OS-WEB-27.
- **Mobile**: concluído até OS-MOBILE-13 (bootstrap, autenticação e telas de negócio base já implementados). Próxima OS a executar: **OS-MOBILE-14**.

Cada OS abaixo é autocontida. Ler a OS inteira antes de começar — dependências e critérios de aceite estão listados em cada uma. Quando uma OS referenciar um padrão já existente no repo (ex: "seguir o mesmo padrão de X"), localizar e seguir a implementação real de X no código antes de escrever algo novo do zero.

---

## 🔴 Bloqueios que não são tarefa de código

Não iniciar até resolvido — são decisões de negócio, não bugs:

- **OS-BACKEND-24** (classificação POC/RET/KM): aguardando definição do gestor sobre origem do campo `tipoVenda` (nativo do Radar vs. inferido) — não implementar suposição, deixar `tipoVenda` sem população automática até a definição chegar.
- **OS-BACKEND-25** (envio de pedido ao ERP): aguardando 6 IDs fixos de referência do Radar (`idFilial`, `idOperacaoComercial`, `idNaturezaOperacao`, `idTabelaPreco`, `idUnidadeVenda`, `idCondicaoPagamento`). `PedidoErpClientService` deve continuar em fail-closed até esses valores serem fornecidos via variável de ambiente/config — não hardcodar valor de exemplo.

Essas duas bloqueiam em cascata a **OS-MOBILE-23** (criação de pedido no app).

---

# BACKEND

## OS-BACKEND-30 — Cadastro automatizado de endpoint via Swagger

**Status**: ainda não implementado (confirmado).

**Objetivo**
Reduzir o trabalho manual de mapear campo a campo ao integrar uma nova entidade do ERP, lendo a especificação Swagger/OpenAPI do Radar automaticamente.

**Escopo**
- `POST /admin/endpoints/importar-swagger` — recebe a URL do Swagger, faz parse do schema de resposta.
- Gera um rascunho de modelo Prisma (campos/tipos inferidos) + rascunho de `*.sync.ts` seguindo o template das strategies existentes em `backend/src/sync/strategies/`, com `map()` pré-preenchido campo a campo.
- Resultado é sempre rascunho para revisão humana — nunca aplicar migration automaticamente em produção. Deixar isso explícito na resposta da API (campo `avisoRevisaoNecessaria: true` ou similar).

**Fora de escopo**
Aplicar migration automaticamente; decidir sozinho qual campo é cursor de data ou chave de dedup — isso fica marcado como `// TODO: revisar` no rascunho gerado.

**Dependências**
Padrão de `SyncStrategy` já existente em `backend/src/sync/`.

**Critérios de aceite**
- Importar o Swagger de um endpoint conhecido (ex: cliente) gera um rascunho reconhecível como sync válido, mesmo que precise de ajuste manual depois.
- Resposta da API sinaliza claramente que é rascunho.

---

## OS-BACKEND-32 — Correção: produto sem preço de venda

**Objetivo**
`Produto.precoVenda` (ou campo equivalente) não está sendo populado na sincronização.

**Passos de diagnóstico (executar nesta ordem antes de corrigir)**
1. Localizar `produto.sync.ts` em `backend/src/sync/strategies/` e conferir o `map()` — qual campo da resposta bruta do Radar está mapeado para preço.
2. Fazer uma chamada manual (script ou log temporário) ao endpoint de produto do Radar e inspecionar a resposta bruta real — confirmar se o nome do campo no `map()` bate exatamente com o que a API retorna (atenção a variação de case, nesting, ou campo vindo em sub-objeto).
3. Se o campo não existir na resposta desse endpoint, verificar se o Radar tem endpoint de preço separado (padrão comum em ERPs — cadastro e tabela de preço às vezes são endpoints distintos). Se existir, isso vira uma nova strategy de sync (`preco-produto.sync.ts`) com seu próprio cursor.

**Escopo**
- Corrigir o mapeamento se for erro de path/nome de campo.
- Se precisar de novo endpoint de preço, implementar strategy adicional seguindo o mesmo padrão das demais (cadência a definir conforme frequência de mudança de preço — sugestão inicial: `INCREMENTAL_NOTURNO`, ajustável depois via OS-BACKEND-15).

**Não escopo**
`tipoVenda` — está fora desta OS, é o bloqueio da OS-BACKEND-24, não misturar as duas correções.

**Critérios de aceite**
- Produto sincronizado exibe preço de venda correto, validado comparando com o valor no Radar/ERP diretamente para uma amostra de produtos.

---

## OS-BACKEND-33 — Histórico e informações adicionais do pedido

**Objetivo**
Rastreabilidade de mudanças de status do pedido — quando mudou, quem mudou — e uma data de negócio explícita, distinta do timestamp técnico de criação.

**Escopo**
- Tabela `PedidoHistoricoStatus` (`pedidoId`, `statusAnterior`, `statusNovo`, `alteradoPor` [usuarioId], `alteradoEm`).
- Popular automaticamente em todo ponto do código que já muda `Pedido.status` (criação, aprovação/rejeição de desconto — `SolicitacaoDesconto`, confirmação de envio ao ERP). Localizar todos esses pontos em `backend/src/pedidos/` antes de implementar, para não deixar nenhuma transição sem registro.
- Avaliar se `Pedido` precisa de campo `dataPedido` separado de `createdAt` (data de negócio vs. timestamp técnico) — se o modelo atual já cobre isso adequadamente, pular essa parte.
- `GET /pedidos/:id/historico` — retorna a lista ordenada de transições.

**Dependências**
Módulo de pedidos já implementado (OS-BACKEND-25).

**Critérios de aceite**
- Toda mudança de status gera entrada no histórico com o usuário responsável correto (nunca "sistema" genérico quando há um ator identificável).
- `GET /pedidos/:id/historico` retorna em ordem cronológica.

---

## OS-BACKEND-34 — Diagnóstico e correção: módulo de estoque não funcionando

**Objetivo**
Determinar a causa raiz da falha no módulo de estoque e corrigir. Esta OS inclui a etapa de diagnóstico porque a causa não está confirmada ainda.

**Passos de diagnóstico (executar nesta ordem)**
1. Verificar `sync_logs` (ou equivalente) da entidade `saldo_estoque` — checar se a última execução teve sucesso, erro, ou se simplesmente não está mais sendo agendada (possível efeito colateral da generalização de config feita na OS-BACKEND-15 — conferir se `saldo_estoque` ainda está corretamente registrado no `upsertJobScheduler` depois dessa mudança).
2. Se o sync está rodando sem erro mas o dado não aparece: testar `EstoqueService.consultarPorIdentificador` diretamente (unit test ou chamada manual) com um produto conhecido, verificando se a query no banco local está correta.
3. Se o sync está falhando: inspecionar erro retornado pela chamada SOAP ao ERP — API SOAP de estoque é mais frágil a mudança de contrato que as REST; comparar o payload/schema esperado com o que está sendo retornado agora.
4. Se o dado está correto no banco mas não aparece na tela: o problema é no consumidor (web/mobile), não no backend — reportar isso e não tentar "corrigir" o backend sem necessidade.

**Escopo**
Corrigir a causa raiz identificada no diagnóstico acima. Não aplicável determinar escopo fechado antes do diagnóstico — a OS termina quando a causa for corrigida e validada ponta a ponta (sync → banco → endpoint → retorno correto).

**Critérios de aceite**
- Consulta de estoque por produto conhecido retorna saldo correto, validado contra o valor real no ERP.
- Sync de `saldo_estoque` aparece com execuções bem-sucedidas e recentes em `sync_logs`.

---

## OS-BACKEND-35 — Correção: estatísticas de cliente + períodos de 1 e 6 meses

**Objetivo**
`GET /clientes/:id/estatisticas` não está retornando total últimos meses, total geral, ticket médio, vendedor responsável.

**Passos de diagnóstico**
1. Verificar se o problema é o endpoint retornando vazio/erro, ou o front não chamando/exibindo corretamente — testar o endpoint isoladamente primeiro (Postman/curl/teste) antes de mexer no front.
2. Causa provável: campo `vendedorResponsavel` depende do vínculo N:N `ClienteVendedor` (OS-BACKEND-23) estar populado para aquele cliente — se o vínculo estiver vazio, é esperado que a estatística volte incompleta. Checar isso antes de assumir bug no cálculo de agregação em si.

**Escopo**
- Corrigir a causa identificada.
- Adicionar suporte explícito a `?meses=1` e `?meses=6` no parâmetro já existente do endpoint (se já aceita número livre, confirmar que esses dois valores funcionam corretamente nas bordas — ex: mês incompleto no momento da consulta).

**Critérios de aceite**
- Estatísticas completas (total período, total geral, ticket médio, vendedor responsável) retornam corretamente para cliente com pedidos e vínculo de vendedor.
- `meses=1` e `meses=6` retornam janelas corretas.

---

## OS-BACKEND-36 — Informações financeiras do cliente

**Objetivo**
Adicionar dados financeiros ao cliente (limite de crédito, inadimplência, notas em aberto).

**Passos de investigação (fazer antes de codar)**
1. Consultar a documentação/Swagger do Radar em busca de endpoint financeiro (contas a receber, limite de crédito por cliente, geralmente separado do cadastro).
2. Se não existir endpoint dedicado, verificar se esses dados vêm embutidos no cadastro de cliente já sincronizado (`cliente.sync.ts`) e simplesmente não estão sendo mapeados.

**Escopo**
- Se existir endpoint próprio: nova strategy de sync (`financeiro-cliente.sync.ts`), seguindo o padrão existente.
- Se vier junto do cadastro: estender `cliente.sync.ts` com os novos campos.
- `GET /clientes/:id/financeiro` — situação de crédito, notas em aberto, inadimplência.
- Se a investigação mostrar que o Radar não expõe isso de forma acessível, documentar essa limitação claramente no retorno da tarefa em vez de simular/inventar dado.

**Critérios de aceite**
- Dado financeiro exibido bate com o ERP para uma amostra de clientes testados manualmente.

---

## OS-BACKEND-37 — Rastreio: percurso completo + fila offline robusta

**Objetivo**
Hoje o rastreio grava pontos em lote (OS-BACKEND-27); o requisito agora é armazenar e expor o **percurso completo** (sequência ordenada de pontos formando rota), com garantia de que lotes grandes acumulados offline por várias horas sejam aceitos.

**Escopo**
- Confirmar que `LocalizacaoUsuario` grava todos os pontos recebidos (não sobrescreve o último) — se já for esse o comportamento, pular para o próximo item; se só guarda o último ponto, migrar o modelo para manter histórico completo.
- `GET /admin/rastreio/:vendedorId/percurso?data=` — retorna pontos ordenados por timestamp, prontos para desenhar como polyline no mapa.
- `POST /rastreio/lote` deve aceitar lotes grandes sem rejeitar por tamanho (ex: 8h de captura acumulada offline, várias centenas de pontos) — remover ou ajustar qualquer limite de payload muito baixo.
- Endpoint deve continuar aceitando envio por qualquer tipo de conexão (wifi ou dados móveis) — não há restrição de rede a implementar no backend, isso é decisão do app (ver OS-MOBILE-20).

**Dependências**
OS-BACKEND-27.

**Critérios de aceite**
- Consulta por vendedor e data retorna todos os pontos do dia em ordem cronológica, suficiente para desenhar o trajeto completo.
- Envio de lote grande (centenas de pontos de uma vez) é aceito sem erro.

---

## OS-BACKEND-38 — Tornar configurável a janela de reprocessamento de nota fiscal

**Objetivo**
A janela fixa de 60 dias em nota fiscal é decisão estrutural (o ERP só filtra por data de emissão, não por alteração) — não é bug, mas deve virar configurável.

**Escopo**
- Adicionar campo de tamanho de janela (hoje fixo em 60 dias) na mesma estrutura de configuração generalizada de sync (OS-BACKEND-15), como um campo adicional distinto de cadência.
- Valor padrão continua 60 dias se nada for configurado.
- Documentar no código/comentário que aumentar a janela aumenta proporcionalmente a carga da execução diária sobre o ERP.

**Dependências**
OS-BACKEND-15.

**Critérios de aceite**
- Alterar a janela via config muda o período reprocessado na próxima execução, sem deploy.

---

## OS-BACKEND-39 — Relatório diário de pedidos por vendedor

**Objetivo**
Vendedor recebe relatório diário com todos os pedidos do dia; pedidos pendentes continuam aparecendo até o status mudar. Escopado por vendedor.

**Escopo**
- `GET /pedidos/relatorio-diario?data=` — pedidos do vendedor logado criados naquele dia + qualquer pedido de dias anteriores que ainda esteja em status "pendente" (usar/criar uma função central `isPendente(status)` reutilizável, em vez de checar string de status espalhado pelo código).
- Escopo por vendedor reaproveitando OS-BACKEND-23 — nunca incluir pedido de outro vendedor.
- Job agendado diário (horário configurável seguindo padrão da OS-BACKEND-15) que monta o relatório por vendedor e dispara notificação push (reaproveitando infraestrutura da OS-BACKEND-19) com resumo (quantidade total, quantos pendentes).

**Dependências**
OS-BACKEND-19 (push), OS-BACKEND-23 (escopo), OS-BACKEND-25 (dados de pedido).

**Critérios de aceite**
- Vendedor A nunca recebe pedido do vendedor B em nenhuma consulta/notificação.
- Pedido pendente de 3 dias atrás continua aparecendo no relatório de hoje.
- Pedido que muda de status some do relatório do dia seguinte, mas permanece consultável no histórico normal.

---

# WEB (Next.js)

## OS-WEB-28 — Correção: navegação sem reload/scroll-reset

**Objetivo**
Mudanças de estado/navegação estão causando reload completo de página ou reset de scroll para o topo — sinal de uso de `<a href>`/navegação hard em vez de client-side routing do Next.js, ou remontagem desnecessária de componente.

**Passos de diagnóstico**
1. Buscar no código por `<a href=` apontando para rotas internas (deveriam ser `next/link` ou `router.push`).
2. Verificar se listas com filtro/paginação estão usando `key` instável (ex: index do array) causando remount completo a cada atualização — trocar por `key` estável (id do registro).
3. Verificar se algum `useEffect` está disparando scroll para o topo intencionalmente (comum em código copiado de outro projeto) sem necessidade real aqui.

**Escopo**
Corrigir cada ocorrência encontrada no diagnóstico. Aplicar em todas as telas administrativas existentes (sincronização, dashboards, clientes, vendedores, rastreio, aprovações, visitas, relatório de pedidos), não só numa tela isolada.

**Critérios de aceite**
- Interações comuns (filtro, paginação, edição inline, aprovação) não recarregam a página nem resetam o scroll.

---

## OS-WEB-29 — Diagnóstico e correção: erro na aba Painel

**Objetivo**
Aba Painel (dashboards, OS-WEB-19) apresenta erro genérico de servidor.

**Passos de diagnóstico**
1. Reproduzir localmente com dados de desenvolvimento/staging e capturar o stack trace real do backend no momento do erro (não só o código genérico do client).
2. Checar cada endpoint de `GET /dashboard/*` (OS-BACKEND-17) isoladamente — candidato mais provável: divisão por zero ou erro de agregação quando não há dados no período selecionado (ex: cliente/vendedor sem pedido no intervalo, causando erro ao calcular ticket médio).
3. Verificar tratamento de filtro de período com valores no limite (ex: período sem nenhum registro deve retornar zero/vazio, não lançar exceção).

**Escopo**
Corrigir a causa identificada, adicionando tratamento defensivo para os casos de "sem dado no período" em todos os endpoints de dashboard, não só no que causou o erro reproduzido.

**Critérios de aceite**
- Aba Painel carrega sem erro em qualquer filtro de período, inclusive períodos sem nenhum dado.

---

## OS-WEB-30 — Correção: formatação de telefone do cliente

**Objetivo**
Telefone exibido como JSON bruto (ex: `[{"ddd":"86","numero":"99946-2281"}]`) em vez de formatado — dado está correto, problema é de renderização.

**Escopo**
- Localizar o(s) componente(s) que exibem telefone de cliente (listagem e detalhe) e implementar formatação: `(DDD) NÚMERO`.
- Campo é array — tratar exibição de múltiplos telefones corretamente (lista, não concatenação bruta).

**Critérios de aceite**
- Telefone aparece formatado em toda tela onde é exibido, inclusive quando o cliente tem mais de um número.

---

## OS-WEB-31 — Revisão da tela de cliente (estatísticas, períodos, financeiro)

**Objetivo**
Atualizar a tela de detalhe de cliente para refletir as correções da OS-BACKEND-35 e os novos dados da OS-BACKEND-36.

**Escopo**
- Corrigir exibição de estatísticas (bug atual).
- Adicionar seletor de período incluindo 1 mês e 6 meses.
- Adicionar seção de informações financeiras.

**Dependências**
OS-BACKEND-35, OS-BACKEND-36 (implementar depois dessas duas estarem prontas).

**Critérios de aceite**
- Estatísticas, ticket médio, total geral e vendedor responsável exibidos corretamente.
- Seletor de período com 1 e 6 meses funcional.
- Dados financeiros exibidos quando disponíveis.

---

## OS-WEB-32 — Painel de rastreio com percurso completo

**Objetivo**
Atualizar o painel de rastreio (OS-WEB-24) para desenhar o trajeto completo do dia (polyline), não só a última posição, e permitir verificar rota por pessoa.

**Escopo**
- Trocar exibição de marcador único por polyline conectando os pontos, consumindo `GET /admin/rastreio/:vendedorId/percurso` (OS-BACKEND-37).
- Manter filtro por vendedor e data já existente — ao selecionar um vendedor, mostrar o percurso isolado dele.

**Dependências**
OS-BACKEND-37.

**Critérios de aceite**
- Selecionar vendedor + data desenha o trajeto completo do dia no mapa.

---

## OS-WEB-33 — Painel de check-ins e visitas (revisão do supervisor)

**Objetivo**
Interface para supervisor/gerente revisar visitas registradas — fotos de check-in, cancelamentos com comentário — consumindo dados já existentes no backend (OS-BACKEND-28).

**Escopo**
- `/admin/visitas` — lista por vendedor/cliente/período, com status (concluída, em andamento, cancelada).
- Detalhe: foto da fachada do check-in, timestamp, coordenadas de check-in/checkout, distância até o pin do cliente.
- Visitas canceladas destacadas, mostrando comentário do vendedor.
- Filtro restrito à equipe do supervisor logado (hierarquia da OS-BACKEND-22); gerente/admin veem tudo.

**Dependências**
OS-BACKEND-28, OS-BACKEND-22.

**Critérios de aceite**
- Supervisor só vê visitas da própria equipe; gerente/admin veem todas.
- Foto e metadados EXIF exibidos corretamente.
- Cancelamento com comentário visível e consultável a qualquer momento.

---

## OS-WEB-34 — Painel administrativo de relatório diário de pedidos

**Objetivo**
Visão de gestão sobre o relatório diário de pedidos (OS-BACKEND-39), consolidada por vendedor/equipe.

**Escopo**
- `/admin/relatorio-pedidos` — pedidos do dia/período agrupados por vendedor, destacando pendentes há mais de 1 dia.
- Filtro por vendedor, status, período — supervisor vê só a equipe, gerente/admin veem geral.
- Contagem de pendentes recorrentes por vendedor (indicador de gargalo de aprovação).

**Dependências**
OS-BACKEND-39, OS-BACKEND-22/23.

**Critérios de aceite**
- Escopo por hierarquia funcionando corretamente.
- Pendente recorrente destacado visualmente.

---

## OS-WEB-25 — Assistente de importação de endpoint via Swagger

**Status**: ainda não implementado (confirmado nesta rodada).

**Objetivo**
Interface para a ferramenta da OS-BACKEND-30.

**Escopo**
Formulário: URL do Swagger → exibe rascunho de modelo/strategy gerado → permite revisão antes de "baixar"/aplicar (nunca aplicação automática direta).

**Dependências**
OS-BACKEND-30.

**Critérios de aceite**
Aviso de "rascunho, revisar antes de aplicar" visível e não ignorável (não é rodapé discreto).

---

# MOBILE (Flutter)

OS-MOBILE-11 (bootstrap), OS-MOBILE-12 (autenticação) e OS-MOBILE-13 (telas de negócio base: cliente, produto, pedido, estoque) já implementadas. Seguir a partir daqui — cada OS depende estruturalmente das telas e da autenticação já existentes no app.

## OS-MOBILE-14 — Home orientada a ação e hierarquia visual nas listas

**Objetivo**
Tela inicial mostrando resumo do dia (pedidos recentes, alertas de estoque baixo) em vez de menu de atalhos; indicadores de cor por situação de pedido e faixa de saldo de estoque nas listagens.

**Dependências**
OS-MOBILE-13.

**Critérios de aceite**
Home mostra conteúdo relevante do dia; situação de pedido e faixa de estoque têm indicador de cor consistente com os tokens do design system.

---

## OS-MOBILE-15 — Busca e favoritos unificados

**Objetivo**
Busca global consumindo `GET /busca` (OS-BACKEND-18) e favoritos locais por vendedor.

**Escopo**
- Campo de busca sempre visível na navegação principal.
- Resultados agrupados por tipo (cliente/produto/pedido).
- Favoritar cliente/produto com persistência local (sem endpoint novo nesta fase).

**Dependências**
OS-BACKEND-18, OS-MOBILE-13.

**Critérios de aceite**
Busca retorna resultados corretos dos três tipos; favoritos persistem entre sessões no mesmo dispositivo.

---

## OS-MOBILE-16 — Infraestrutura de notificações push

**Objetivo**
Integração com Firebase Cloud Messaging — registro de token, recepção em foreground/background, navegação ao tocar.

**Escopo**
- Configurar `google-services.json` (Android) e `GoogleService-Info.plist` (iOS) — já obtidos/orientados fora desta OS.
- Registro/atualização de token no backend (`DispositivoUsuario`, OS-BACKEND-19) no login.
- Navegação correta ao tocar em cada tipo de notificação (pedido, aprovação, visita cancelada, relatório diário).
- Tela simples de configuração (ligar/desligar tipos de notificação).

**Dependências**
OS-BACKEND-19, OS-MOBILE-12.

**Critérios de aceite**
Token registrado e atualizado corretamente; notificação recebida com app aberto e fechado, navegando corretamente ao toque.

---

## OS-MOBILE-17 — Roteiro e mapa de visitas

**Objetivo**
Mapa com clientes da carteira do vendedor e agenda de visitas planejadas.

**Escopo**
- Mapa com clientes (endereços já sincronizados).
- Agenda do dia (lista de visitas planejadas, `GET /visitas`).
- Sem roteirização otimizada nesta fase — só exibição dos pontos.

**Dependências**
OS-BACKEND-21 (dados de visita, se aplicável), OS-MOBILE-13.

**Critérios de aceite**
Vendedor visualiza clientes no mapa e agenda de visitas do dia corretamente.

---

## OS-MOBILE-18 — Resumo de carteira do cliente (IA)

**Objetivo**
Exibir o resumo gerado por IA (OS-BACKEND-20, já implementado no backend — só falta chave de API conforme já orientado) na tela de detalhe do cliente.

**Escopo**
- Card no topo do detalhe do cliente com o resumo.
- Estado de carregamento e erro tratados (chamada pode demorar mais por depender de LLM).

**Dependências**
OS-BACKEND-20, OS-MOBILE-13.

**Critérios de aceite**
Resumo exibido corretamente formatado, com loading state e fallback claro em caso de falha.

---

## OS-MOBILE-20 — Rastreio de localização em background com percurso offline

**Objetivo**
Captura periódica de posição em background, acumulando localmente o percurso completo mesmo sem conexão, e envio em lote assim que houver qualquer conexão disponível (wifi ou dados móveis).

**Escopo**
- Serviço de geolocalização em background — validar limitações reais de iOS/Android para captura com app em background/fechado antes de assumir viabilidade total.
- Fila local persistente (banco local, ver OS-MOBILE-22) acumulando pontos indefinidamente enquanto offline — sem perda de dado.
- Envio em lote via `POST /rastreio/lote` (OS-BACKEND-37) assim que detectar qualquer conectividade — não restringir a wifi.
- Intervalo de captura configurável localmente (ex: 1, 5, 15 minutos).
- Permissão de localização solicitada com explicação clara ao usuário sobre o motivo.

**Dependências**
OS-BACKEND-37.

**Critérios de aceite**
- App captura e acumula pontos mesmo totalmente offline por período extenso, sem perda.
- Ao reconectar (wifi ou dados móveis), todos os pontos acumulados são enviados corretamente com timestamp original preservado.

---

## OS-MOBILE-21 — Check-in/checkout de visita

**Objetivo**
Fluxo completo de check-in/checkout com validação de proximidade, foto obrigatória por câmera e comentário de cancelamento — espelhando exatamente o que já está implementado no backend (OS-BACKEND-28).

**Escopo**
- Botão de check-in no detalhe do cliente, validando raio de 50m do pin cadastrado do cliente antes de permitir.
- Captura de foto **exclusivamente via câmera nativa do app** — a tela de captura não deve oferecer opção de selecionar da galeria em nenhum momento (requisito de UI, já que o backend só consegue validar via EXIF como segunda camada, não substitui essa restrição de interface).
- Checkout com mesma validação de raio de 50m.
- Fluxo de cancelamento com campo de comentário obrigatório, notificando o supervisor.
- Indicador de "visita em andamento" enquanto não houver checkout.

**Dependências**
OS-BACKEND-28.

**Critérios de aceite**
- Check-in/checkout bloqueados fora do raio de 50m, com mensagem clara.
- Não existe, em nenhum ponto da UI, opção de escolher foto da galeria — só captura direta.
- Cancelamento com comentário chega corretamente ao supervisor.

---

## OS-MOBILE-22 — Sincronização offline completa

**Objetivo**
Banco local completo espelhando os dados do vendedor logado, populado via snapshot do backend, com fila de ações pendentes (pedidos, check-in/checkout, lotes de rastreio) sincronizada ao reconectar.

**Escopo**
- Banco local (SQLite via `drift`/`sqflite`, ou Hive) populado por `GET /mobile/snapshot` (OS-BACKEND-29).
- Fila de ações pendentes com id local único (idempotência), enviada via `POST /mobile/fila-pendente` ao reconectar.
- Indicador visual de "pendente de envio" em itens criados offline até confirmação do servidor.

**Dependências**
OS-BACKEND-29.

**Nota**: substitui integralmente a ideia anterior de "cache simples de última resposta" (não implementar as duas abordagens, só esta).

**Critérios de aceite**
- App funciona para leitura totalmente offline após o primeiro snapshot.
- Ação offline aparece como "pendente" e depois "confirmada" corretamente ao sincronizar; reenvio da mesma ação não duplica efeito no servidor.

---

## OS-MOBILE-23 — Criação de pedido no app

**🔴 Bloqueado** — depende de OS-BACKEND-24 e OS-BACKEND-25 estarem desbloqueadas. Não iniciar antes disso.

**Objetivo**
Fluxo de criação de pedido com cálculo automático por tipo de venda (POC/RET/KM).

**Escopo**
- Selecionar cliente (só da própria carteira) → adicionar produtos → campo de entrada adaptado ao `tipoVenda` do produto, chamando `POST /produtos/:id/calcular` em tempo real.
- Campo de desconto com aviso visível se ultrapassar o limite configurado (hoje 20%) — "este pedido vai para aprovação do seu supervisor".
- Pedido criado offline entra na fila da OS-MOBILE-22.

**Dependências**
OS-BACKEND-24, OS-BACKEND-25, OS-MOBILE-22.

**Critérios de aceite**
- Cálculo exibido bate exatamente com o que o backend confirma ao gravar.
- Desconto acima do limite deixa claro, antes de confirmar, que o pedido ficará pendente.

---

## OS-MOBILE-24 — Escopo de clientes por vendedor

**Objetivo**
Aplicar no app a restrição de visibilidade já garantida pelo backend (OS-BACKEND-23).

**Escopo**
- Listagem de clientes consumindo o endpoint já escopado (sem filtro adicional no app).
- Tela de verificação de conflito (`GET /clientes/verificar-conflito`) ao tentar cadastrar/prospectar por CPF/CNPJ.

**Dependências**
OS-BACKEND-23, OS-MOBILE-13.

**Critérios de aceite**
Vendedor nunca visualiza cliente de outro vendedor além do aviso de conflito.

---

## OS-MOBILE-25 — Métricas de cliente no detalhe

**Objetivo**
Exibir estatísticas (OS-BACKEND-35) e histórico de visitas (OS-BACKEND-28) no detalhe do cliente do app.

**Dependências**
OS-BACKEND-35, OS-BACKEND-28.

**Critérios de aceite**
Dados exibidos batem com os endpoints correspondentes.

---

## OS-MOBILE-26 — Notificação e fluxo de aprovação de desconto

**Objetivo**
Fechar o ciclo de aprovação de desconto no app — vendedor recebe status, supervisor/gerente aprova/rejeita pelo próprio celular.

**Escopo**
- Vendedor: status visível no pedido quando aprovado/rejeitado, com notificação.
- Supervisor/gerente: tela de aprovações pendentes com ação de aprovar/rejeitar.

**Dependências**
OS-BACKEND-22, OS-MOBILE-16.

**Critérios de aceite**
Supervisor aprova/rejeita pelo celular; vendedor recebe retorno claro do resultado sem precisar abrir manualmente para descobrir.

---

## OS-MOBILE-27 — Tela e notificação de relatório diário

**Objetivo**
Exibir o relatório diário (OS-BACKEND-39), com destaque para pendentes recorrentes.

**Escopo**
- Tela "Meus pedidos do dia" consumindo `GET /pedidos/relatorio-diario`.
- Indicador visual diferenciado para pedidos pendentes há mais de um dia.
- Recepção de notificação push diária, abrindo direto na tela ao tocar.

**Dependências**
OS-BACKEND-39, OS-MOBILE-16.

**Critérios de aceite**
Notificação abre a tela já carregada; pedido pendente há vários dias é visualmente distinguível de pendente do próprio dia.

---
---

# Adendo — rodada `OS-novas-rodada.md` / `OS-ajustes-layout-mobile.md`

As OS acima (BACKEND-30 a 39, WEB-25/28-34, MOBILE-14-27) refletem o
estado do backlog numa rodada anterior — várias já foram concluídas desde
então (conferir `git log` antes de assumir pendente; ex.: OS-BACKEND-33/38,
OS-WEB-25/27 já aparecem commitadas). O que segue é o adendo desta rodada,
cobrindo `OS-novas-rodada.md` e `OS-ajustes-layout-mobile.md`.

Já concluídas e enviadas: OS-MOBILE-31/33/36 (estabilidade de conexão),
OS-BACKEND-41 + extensão DELETE (módulo de documentos), OS-MOBILE-34 e
OS-WEB-38 (documentos, mobile + painel admin), OS-MOBILE-38 (inicialização
offline-first), OS-MOBILE-39 (sincronização em segundo plano via
WorkManager), OS-MOBILE-28 (tratamento de erro/timeout do WebView de
login), OS-WEB-35 (skill não existe com esse nome no projeto - é
`design-system` - e não há nenhuma referência a `.claude/` em nenhum
código-fonte do frontend; UI não tem dependência de runtime com skill
nenhuma, por arquitetura), OS-WEB-36 (auditoria feita - as 6 telas já
estão consistentes com os tokens/componentes atuais, sem retrofit
necessário), OS-MOBILE-30 (achado: web e mobile usam paletas diferentes
hoje - "Constructive" no web vs. "Nexo Comercial" no mobile, da rodada de
redesign desta sessão; decisão do usuário foi manter como está, dois
produtos com identidade visual própria - sem mudança de código),
OS-BACKEND-40 (docs/casos-de-uso-ia.md entregue), OS-WEB-37 (rankings horizontais, largura total; ranking de
vendedores ficou de fora por decisão do usuário - sem "principal" no
vínculo N:N Cliente-Vendedor), OS-BACKEND-42 (auditoria + correção
aplicada: pedido/nota-fiscal/vendedor migrados pra BullMQ Job Scheduler,
mesmo mecanismo que produto já usava - causa raiz era @Cron simples sem
persistência/catch-up). Também corrigido no caminho (fora do escopo
original das OS, bugs
reais encontrados): sessão expirada quebrava a checagem de auth
(`obterUsuarioAtual`), `ref.mounted` faltando na revalidação em segundo
plano do `AuthNotifier`, check-in/checkout/cancelamento de visita
**perdiam a ação** se offline no momento (nunca enfileiravam, diferente
do rastreio - corrigido), estoque nunca tinha fallback offline (snapshot
+ cache local + UI, corrigido), e um segundo bug real em `nota-fiscal`
encontrado na mesma auditoria (independente da migração pro Job
Scheduler): `SyncService.obterDesde()` montava o nome da variável de
ambiente a partir do nome da entidade em maiúsculas sem tratar hífen -
"nota-fiscal" virava `WK_RADAR_NOTA-FISCAL_DATA_INICIO_CARGA`, inválido
tanto pro `.env` quanto pra interpolação `${...}` do docker-compose.
Como a entidade nunca teve `ultimaSincronizacao` gravada, toda tentativa
de sync lançava erro **antes** de gravar em `sync_logs` - por fora
parecia sincronização travada para sempre, quando na real falhava
instantânea e silenciosamente a cada execução. Corrigido sanitizando o
hífen (`.replace(/-/g, '_')`) em `sync.service.ts`, com teste de
regressão dedicado; confirmado funcionando ponta a ponta após redeploy
(autenticou no WK Radar e começou a buscar nota fiscal normalmente).

## Bloqueada — movidas de `OS-novas-rodada.md` (texto original completo)

As 4 OS abaixo são as únicas ainda pendentes de `OS-novas-rodada.md` (as
demais 15 já constam concluídas no parágrafo "Já concluídas e enviadas"
acima) - texto movido na íntegra do arquivo original, com o status atual
anotado ao final de cada uma.

### OS-MOBILE-29 — Validação ponta a ponta do push do Firebase

**Objetivo**
Testar o fluxo completo de notificação push já implementado (OS-MOBILE-16 + OS-BACKEND-19), cobrindo os casos que mais falham silenciosamente em produção. Apenas android, esse app não tem versão para iOS.

**Escopo (roteiro de teste, não é feature nova)**
- App em foreground: notificação aparece corretamente (não é comportamento padrão do FCM — precisa de handler explícito, confirmar que existe).
- App em background: notificação aparece na bandeja do sistema e, ao tocar, abre na tela correta.
- App fechado (matado pelo sistema): mesma validação do item acima.
- Token expirado/renovado: confirmar que o app re-registra o novo token no backend automaticamente, sem exigir novo login.
- Dispositivo sem Google Play Services (raro, mas existe em alguns Android de fábrica alternativa) — confirmar que o app não trava, só falha silenciosamente sem push.
- Reportar como bug (não corrigir nesta OS) qualquer cenário acima que falhar, para virar OS de correção específica.

**Critérios de aceite**
Cada cenário acima documentado como passou/falhou, com print/log de evidência.

**Status**: não iniciada. Não é código novo, é roteiro de teste manual — precisa de dispositivo físico, não dá pra fazer daqui.

---

### OS-MOBILE-32 — Configuração do app para acesso fora da rede interna da empresa

**Objetivo**
Definir e implementar como o app conversa com o backend quando o dispositivo está fora da rede da empresa — isso provavelmente é a causa raiz da OS-MOBILE-31.

**Contexto necessário antes de implementar**
O app hoje provavelmente está configurado com a URL interna do backend (IP local ou hostname só resolvível dentro da rede da empresa). Para funcionar fora, o backend precisa estar acessível por um domínio público — a decisão de infraestrutura (Cloudflare Tunnel + Access, já discutida e recomendada anteriormente neste projeto, dado que a empresa já usa Cloudflare) precisa estar implementada no lado do servidor **antes** desta OS fazer sentido no app.

**Escopo**
- Confirmar com quem administra o servidor se o túnel/domínio público já está configurado (ex: `api.suaempresa.com.br` via Cloudflare Tunnel). Se ainda não estiver, esta OS fica bloqueada até isso existir — não adianta mudar a URL no app para um endereço que ainda não é público.
- Trocar a URL base do app do endereço interno para o domínio público.
- Se o backend estiver atrás de Cloudflare Access, testar se o fluxo de autenticação completa corretamente dentro do WebView do app (ponto de atenção já identificado anteriormente — alguns fluxos de Access assumem browser completo, não WebView embutido; testar isso é obrigatório antes de considerar a OS concluída).
- Variável de ambiente/config de build para trocar facilmente entre URL interna (desenvolvimento) e URL pública (produção), sem precisar editar código a cada build.

**Dependências**
Domínio público do backend configurado no servidor (fora do escopo desta OS — é infraestrutura, não código do app).

**Critérios de aceite**
- App funciona corretamente com o dispositivo fora da rede wifi da empresa (testar em dados móveis e wifi doméstico).
- Login completo funcional mesmo fora da rede da empresa.

**Status**: bloqueada. Confirmado com o usuário que o túnel Cloudflare ainda não está configurado no servidor. Sem isso, trocar `API_BASE_URL` não tem pra onde apontar.

---

### OS-MOBILE-35 — Atualização automática do app (OTA) sem passar pela loja a cada vez

**Objetivo**
Permitir atualizar o app sem exigir que o usuário baixe uma nova versão completa pela Play Store/App Store a cada mudança pequena.

**Contexto necessário antes de implementar**
Existem duas naturezas de "atualização" diferentes, e a solução muda completamente dependendo de qual você quer:
1. **Atualização de código Dart/lógica de negócio** (telas, regras, textos) — isso pode usar OTA de verdade via **Shorebird** (ferramenta específica para apps Flutter, permite enviar patch de código sem passar pela loja).
2. **Atualização de código nativo** (nova permissão, nova dependência nativa, mudança de ícone, mudança de versão do Flutter/SDK) — isso **nunca** pode ser OTA, sempre exige passar pela loja, é limitação de plataforma (Google/Apple), não do projeto.

**Escopo**
- Avaliar e, se aprovado, integrar o Shorebird ao pipeline de build do app — ele permite enviar "patches" de código Dart direto aos dispositivos já instalados, sem re-submissão à loja.
- Implementar verificação de patch disponível na inicialização do app (o Shorebird já cobre isso automaticamente na maior parte dos casos, mas confirmar o comportamento de UX: aplica silenciosamente, ou avisa o usuário).
- Deixar explícito, inclusive em documentação interna, que mudanças nativas continuam exigindo publicação normal na loja — não prometer OTA para tudo.

**Fora de escopo**
Atualização de recursos nativos (permissões, versão de SDK) — isso é ciclo normal de loja, sem solução de contorno real.

**Critérios de aceite**
- Uma mudança de código Dart simples (ex: texto de uma tela) é enviada e aplicada nos dispositivos já instalados sem exigir nova instalação via loja.
- Mudança que envolve código nativo é claramente identificada como exigindo publicação tradicional, não é forçada por essa via.

**Status**: bloqueada em ação do usuário. Decisão de adotar já confirmada ("Sim, integrar agora"). Shorebird CLI 1.6.120 instalado e empacotado numa imagem Docker própria (`copperline-flutter-shorebird`), pronta pra uso. O login browser-based (`shorebird login`) não funciona de dentro de um container headless (callback OAuth bind numa porta local aleatória, sem como pré-mapear no Docker) - o caminho correto pra CI/automação é API key, não login interativo. Falta o usuário:
1. Criar conta em https://console.shorebird.dev (ou logar, se já tiver).
2. Ir em Account → API Keys → Create API Key.
3. Copiar o valor da chave (mostrado só uma vez) e enviar aqui.
Com a chave em mãos, o resto (`SHOREBIRD_TOKEN` no ambiente de build, `shorebird init` no `mobile/`, wiring no fluxo de release/patch) segue sem precisar de mais nenhuma ação manual do usuário.

---

### OS-MOBILE-37 — Auto-limpeza de cache local de rotas ao detectar alteração no servidor

**Objetivo**
Garantir que o cache de **rotas/trajeto de rastreio** exibido no app não fique desatualizado — ao haver alteração relevante no servidor, o app deve atualizar automaticamente essa informação, sem exigir o usuário limpar o cache manualmente.

**Importante — escopo restrito**
Esta limpeza automática se aplica **exclusivamente aos dados de rota/trajeto** (pontos de rastreio exibidos no mapa, histórico de percurso). Os demais dados salvos localmente pela sincronização offline (OS-MOBILE-22) — **estoque, clientes, pedidos, produtos** — **não** devem ser apagados ou invalidados por esta rotina em nenhuma hipótese. Esses dados seguem exclusivamente a lógica de sincronização incremental já definida na OS-MOBILE-22/OS-BACKEND-29 (snapshot + fila), que já trata atualização corretamente sem apagar nada indevidamente.

**Escopo**
- Cache local de rota guarda um identificador de versão (ex: timestamp do último ponto sincronizado daquele dia/vendedor).
- Ao abrir a tela de rastreio/percurso (ou em intervalo definido), comparar a versão local com a do servidor; se divergente, buscar e atualizar só os pontos de rota novos/alterados.
- Caso raro de inconsistência real do cache de rota (não simples atualização incremental) pode disparar limpeza total **apenas da tabela/coleção de rota**, nunca de outra entidade.
- Validar explicitamente, como parte do critério de aceite, que a rotina de limpeza não toca em nenhuma tabela/coleção fora da de rota — isso deve ser garantido por escopo de código (a função de limpeza só deve ter acesso à store de rota, não a um "limpar tudo" genérico).

**Dependências**
OS-BACKEND-37 (percurso completo), OS-MOBILE-20 (captura de rota offline).

**Critérios de aceite**
- Alteração de dado de rota no servidor reflete no app na próxima sincronização automática, sem exigir ação manual.
- Dados de estoque, clientes, pedidos e produtos permanecem intactos no banco local durante e após qualquer execução desta rotina — testar explicitamente populando o app com dados de todas as entidades, disparando a limpeza de rota, e confirmando que as demais entidades continuam presentes sem re-sincronizar.
- Cache de rota não é apagado por completo a cada pequena diferença — só atualiza o que mudou, exceto no caso raro de inconsistência.

**Status**: bloqueada por decisão do usuário. A OS pede limpeza automática de um cache local de rota/trajeto no APP MOBILE, mas esse cache não existe: o app só *envia* pontos de rastreio (captura e enfileira pra upload, `rastreio_service.dart`), nunca *lê/exibe* um trajeto de volta - a exibição de percurso (polyline) só existe hoje no painel web (OS-WEB-32, visão do supervisor). Sem base pra implementar sem antes construir uma tela de trajeto no mobile que não foi pedida por nenhuma OS - decisão do usuário foi não inventar essa tela só pra ter o que limpar.

## Não iniciadas — `OS-ajustes-layout-mobile.md`

Restam só os itens que dependem de decisão de dado real no backend (meta/
roteiro de visita, filtro agregado de cliente) — sem isso, vira número
inventado, o que o projeto não faz.

### 3. Barra de progresso de visitas sumiu (home)
Omitida de propósito (sem dado real de roteiro/meta no backend). Precisa
de decisão: expor endpoint de "visitas planejadas vs. realizadas" no
backend, ou ajustar a referência visual pra não depender desse dado. Não
implementar com número inventado.

### 6. Clientes: faltam chips de filtro e botão "Ver todos os clientes"
Filtros "Todos"/"Com pedido"/"Sem visita" exigem parâmetro/contagem
agregada nova no `GET /clientes` (hoje só aceita `nome`/`cpfCnpj`) — não
implementar com número decorativo. Botão "Ver todos": confirmar se não é
redundante com a paginação já existente, ou se a intenção é outra (carteira
completa da empresa vs. só do vendedor — implicação de permissão/escopo).

### 7. Relatório: falta "Resultado do dia" / "Acima da meta" / "Meta diária"
Mesma causa raiz do item 3 — sem meta configurável no backend hoje. Decisão
necessária: backend expõe meta (por vendedor ou global) antes de completar
o card, ou referência visual é ajustada pra não depender disso.

**Atualização**: meta MENSAL por vendedor passou a existir (OS-BACKEND-44,
`GET /vendedores/:id/meta-progresso`) e já é consumida no app (gauge de
meta na home, OS-MOBILE-41). Isso NÃO resolve os itens 3/7 acima como
estão escritos - ambos pedem "meta DIÁRIA"/"roteiro de visitas planejadas
vs. realizadas", conceito que ainda não existe no backend (só meta de
valor vendido no MÊS). Segue bloqueado enquanto essa decisão de produto
não for tomada.

---

# Adendo — rodada `OS-CONSOLIDADO-FINAL.md`

Concluídas nesta rodada, sem intervenção do usuário: OS-BACKEND-43
(boleto - `Financeiro.svc`), OS-BACKEND-44 a 50 (metas/gamificação,
oportunidades com IA, coberturas temporárias, sazonalidade, contexto de
IA na aprovação de desconto), OS-WEB-41/OS-MOBILE-42 (funil de pedidos e
stepper de status, web + mobile), OS-WEB-42/OS-MOBILE-40 (timeline
unificada do relacionamento, web + mobile), OS-MOBILE-41 (indicadores
visuais na home - gauge de meta, sparkline de vendas semanais via
endpoint novo `GET /vendedores/me/vendas-semanais`, barra de saldo de
estoque do produto favoritado), OS-WEB-40 (comparativo radar de
vendedores via `GET /dashboard/comparativo-vendedores`), OS-WEB-39 (mapa
de calor de vendas via `GET /dashboard/mapa-calor-vendas`).

## Bloqueadas — precisam do WSDL de `Comercial.svc`

Usuário forneceu o WSDL de `Financeiro.svc` nesta rodada (usado pra
concluir o boleto da OS-BACKEND-43), mas não o de `Comercial.svc`. Sem
ele, seguem bloqueadas (regra do topo do `OS-CONSOLIDADO-FINAL.md`:
"SEMPRE QUE PRECISAR DE SCHEMA DO MOTOR ANTIGO, PEDIR PARA COLAR" - não
adivinhar shape de SOAP):

- **OS-BACKEND-43 (resto)**: PDF/XML de nota fiscal
  (`BuscarTokenPDFNFe`/`DownloadPDFNFe`, `BuscarTokenXMLNotas`/
  `DownloadXMLNFeNFSe`) - só o boleto (via `Financeiro.svc`) foi
  concluído.
- **OS-BACKEND-25 (adição desta revisão)**: simulação via
  `EfetuarPreCalculoPedido` - não desbloqueia o envio real de pedido (que
  segue dependendo dos 6 IDs, ver bloqueio original acima), só a etapa
  de simulação/validação de cálculo.

## Bloqueadas — dependem de OS-BACKEND-25 (envio de pedido ao ERP)

Mesmo bloqueio já documentado no topo deste arquivo (6 IDs de referência
do Radar). Novas OS que dependem disso, adicionadas nesta rodada:

- **OS-BACKEND-46** (repetir pedido anterior + sugestão de produto
  complementar via IA): "repetir pedido" pressupõe conseguir CRIAR um
  pedido de verdade a partir de um anterior - sem `POST /pedidos`
  funcional, não há o que repetir.
- **OS-BACKEND-47** (assinatura digital de pedido): não há pedido real
  criado pelo app pra assinar (fluxo de criação ainda 100% bloqueado).
