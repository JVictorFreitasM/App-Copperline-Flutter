# DETALHE IMPORTANTE: SEMPRE QUE PRECISAR DE SCHEMA DO MOTOR ANTIGO(SOAP/XML), ME PEDIR PARA EU COLAR.
# USE APACHE ECHARTS PARA OS GRÁFICOS. E TAMBÉM PARA O MAPA DE CALOR

# OS Consolidadas — App Copperline (versão final para Claude Code)

Este documento substitui os arquivos de OS anteriores. Reflete tudo decidido até agora, incluindo os achados do Swagger REST e do WSDL SOAP antigo do Radar.

**Status confirmado:**
- Backend: tudo implementado até OS-BACKEND-20, exceto os dois bloqueios abaixo.
- Web: implementado até OS-WEB-27.
- Mobile: implementado até OS-MOBILE-13 (bootstrap, autenticação, telas base).

---

## 🔴 Bloqueios que não são tarefa de código

- **OS-BACKEND-24** (classificação POC/RET/KM): já **desbloqueada** pela definição do usuário — ver escopo revisado abaixo. Não é mais bloqueio.
- **OS-BACKEND-25** (envio de pedido ao ERP): segue bloqueada — faltam os 6 IDs fixos de referência (`idFilial`, `idOperacaoComercial`, `idNaturezaOperacao`, `idTabelaPreco`, `idUnidadeVenda`, `idCondicaoPagamento`). `EfetuarPreCalculoPedido` (SOAP) pode ser usado para simular/validar cálculo sem esses IDs, mas o envio real continua bloqueado até eles chegarem.

---

# BACKEND

## OS-BACKEND-22-A — Endpoint de simulação de aprovação de desconto

**Objetivo:** Expor `avaliarDesconto()` (hoje só método interno) via endpoint HTTP.

**Escopo:** `POST /pedidos/simular-desconto` — recebe desconto proposto, retorna se seria aprovado direto ou precisa de aprovação (+ quem seria o aprovador), sem criar nada.

**Critério de aceite:** desconto ≤ limite retorna "aprovado direto"; acima retorna "precisa de aprovação" + aprovador correto.

---

## OS-BACKEND-24 — Classificação POC / RET / KM (revisão final, desbloqueada)

**Regra de negócio confirmada:**
- **POC (pocket)**: peças fixas de 10m, 20m ou 30m. Entrada é `quantidadePecas` (inteiro ≥ 1). `metrosTotais = quantidadePecas × tamanhoPeca`. `valorTotal = quantidadePecas × precoUnitarioPeca`.
- **RET (retalho)**: metragem fracionária livre, `0 < metros < 50`. `valorTotal = metros × precoUnitarioPorMetro`.
- **KM**: metragem ≥ 50, em **incrementos fixos de 5m** (50, 55, 60...). `valorTotal = (metros / 1000) × precoUnitarioPorKm`. Rejeitar valor que não seja múltiplo de 5 ou menor que 50, sugerindo os dois valores válidos mais próximos.

**Escopo:**
- Campo `tipoVenda` em `Produto` (`POC`, `RET`, `KM`) — confirmar com o time se vem de campo nativo do Radar ou é derivado do comprimento cadastrado (regra: comprimento ∈ {10,20,30} → POC; ≥50 → KM; caso contrário → RET, se aplicável ao produto).
- Serviço `calcularQuantidadePedido(produtoId, entrada)` implementando a regra acima como função pura testável.
- `POST /produtos/:id/calcular` — usado tanto no web (OS-WEB-22) quanto no mobile (OS-MOBILE-23).
- Preço de POC: confirmar se o Radar entrega preço já "por peça" ou se precisa ser derivado de preço-por-metro × tamanho da peça (ver OS-BACKEND-32).

**Critérios de aceite:**
- POC de 20m com `quantidadePecas=2` → 40m, valor = 2× preço da peça.
- RET com `metros=47` → valor proporcional fracionário correto.
- KM com `metros=65` → `0,065 km`, valor correto.
- KM com `metros=62` → rejeitado, sugerindo 60 e 65.
- KM com `metros=47` → rejeitado, orientando para RET.

---

## OS-BACKEND-25 — Envio de pedido ao ERP (bloqueada)

**Escopo (já implementado, aguardando desbloqueio):** `POST /pedidos` completo — validação de escopo (OS-BACKEND-23), cálculo por item (OS-BACKEND-24), decisão de aprovação (OS-BACKEND-22), persistência local, ordem anti-órfão (tenta ERP antes de gravar).

**Adição desta revisão:** usar `EfetuarPreCalculoPedido` (SOAP `Comercial.svc`) como etapa de simulação/validação — envia cliente + itens + condição de pagamento + filial + operação comercial e recebe de volta impostos e totais calculados, **sem criar o pedido**. Isso não desbloqueia o envio real (ainda depende dos 6 IDs), mas permite testar a lógica de cálculo do lado do ERP antes de liberar.

**Bloqueio real:** os 6 IDs de referência (`idFilial`, `idOperacaoComercial`, `idNaturezaOperacao`, `idTabelaPreco`, `idUnidadeVenda`, `idCondicaoPagamento`). Cada um tem endpoint próprio de consulta no REST (`filial`, `operacao-comercial`, `natureza-operacao`, `condicao-pagamento`, `tabela-preco-venda-produto`, `unidade-medida-produto`) para facilitar a escolha, mas a decisão de qual usar é do usuário.

**Critérios de aceite (quando desbloqueado):** pedido dentro do limite de desconto vai direto ao ERP; acima do limite fica `AGUARDANDO_APROVACAO`; erro do ERP não deixa registro órfão local.

---

## OS-BACKEND-29 — Suporte a sincronização offline do mobile

**Escopo:** `GET /mobile/snapshot` (dados escopados do vendedor logado: cliente, produto, pedido, estoque) e `POST /mobile/fila-pendente` (recebe ações offline com id único, idempotente).

**Critérios de aceite:** reenvio da mesma ação não duplica; cada item da fila retorna status individual.

---

## OS-BACKEND-30 — Cadastro automatizado de endpoint via Swagger

**Status:** não implementado.

**Escopo:** `POST /admin/endpoints/importar-swagger` — lê a URL do Swagger, gera rascunho de modelo Prisma + rascunho de `*.sync.ts` seguindo o padrão de `backend/src/sync/strategies/`. Resultado é sempre rascunho para revisão humana — nunca aplicar migration automaticamente.

**Critérios de aceite:** importar Swagger de endpoint conhecido gera rascunho reconhecível como sync válido; API sinaliza claramente que é rascunho.

---

## OS-BACKEND-31 — Relatório diário de pedidos por vendedor

**Escopo:** `GET /pedidos/relatorio-diario?data=` — pedidos do dia do vendedor + pedidos anteriores ainda pendentes (usar função central `isPendente(status)`). Escopado por vendedor (OS-BACKEND-23). Job diário dispara push (OS-BACKEND-19) com resumo.

**Critérios de aceite:** vendedor A nunca recebe pedido do vendedor B; pendente de 3 dias atrás continua aparecendo; pedido resolvido some do relatório do dia seguinte mas continua no histórico.

---

## OS-BACKEND-32 — Correção: produto sem preço de venda

**Causa confirmada:** `precoVenda` já vem no próprio endpoint de Produto do Radar (`empresarial/v1/produto`) — não é endpoint separado. É erro de mapeamento em `produto.sync.ts`.

**Escopo:** corrigir o `map()` de `produto.sync.ts` para popular `precoVenda` corretamente. Validar contra o valor real no Radar para amostra de produtos.

**Critérios de aceite:** produto sincronizado exibe preço correto, validado manualmente contra o ERP.

---

## OS-BACKEND-33 — Histórico e informações adicionais do pedido

**Escopo:** tabela `PedidoHistoricoStatus` (pedidoId, statusAnterior, statusNovo, alteradoPor, alteradoEm), populada em todo ponto que já muda `Pedido.status`. Avaliar necessidade de campo `dataPedido` distinto de `createdAt`. `GET /pedidos/:id/historico`.

**Critérios de aceite:** toda mudança de status gera entrada com responsável correto; histórico em ordem cronológica.

---

## OS-BACKEND-34 — Diagnóstico e correção: módulo de estoque

**Passos de diagnóstico:**
1. Verificar `sync_logs` da entidade `saldo_estoque` — checar se ainda está corretamente registrada no `upsertJobScheduler` após a generalização da OS-BACKEND-15.
2. Se sync roda sem erro mas dado não aparece: testar `EstoqueService.consultarPorIdentificador` isoladamente.
3. Se sync falha: inspecionar erro da chamada SOAP — API SOAP de estoque é frágil a mudança de contrato.
4. Se dado está correto no banco mas não aparece na tela: problema é no consumidor (web/mobile), não no backend.

**Nota:** não migrar para REST — confirmado que `movimento-estoque` (REST) só tem transações, sem saldo corrente; SOAP continua sendo a fonte certa.

**Critérios de aceite:** saldo de produto conhecido bate com o ERP; `saldo_estoque` aparece com execuções recentes bem-sucedidas em `sync_logs`.

---

## OS-BACKEND-35 — Correção: estatísticas de cliente + períodos de 1 e 6 meses

**Passos de diagnóstico:** testar `GET /clientes/:id/estatisticas` isoladamente antes de mexer no front; causa provável é vínculo `ClienteVendedor` (OS-BACKEND-23) vazio para o cliente testado.

**Escopo:** corrigir causa raiz; adicionar suporte explícito a `meses=1` e `meses=6`.

**Critérios de aceite:** estatísticas completas retornam para cliente com pedidos e vínculo; `meses=1`/`meses=6` retornam janelas corretas.

---

## OS-BACKEND-36 — Informações financeiras do cliente (revisão final)

**Fonte confirmada:** `BuscarPosicaoFinanceira` (SOAP `Financeiro.svc`) — retorna `PosicaoFinanceira` já pronta com: `ValorLimite`, `ValorCreditoDisponivel`, `ValorCreditoUtilizado`, `ValorSaldoAVencer`, `ValorSaldoVencido`, `MediaAtraso`, `MaiorAtraso`, `DataUltimaFatura`, `ValorTotalDeCompras`, `QtdeBaixasPorInadimplencia`, `VendaBloqueada`, `ValorLimiteSerasa`, entre outros. Não é necessário somar título por título — o ERP já entrega o perfil de crédito calculado.

**Escopo:**
- Integração SOAP com `BuscarPosicaoFinanceira`, filtrando por cliente.
- `GET /clientes/:id/financeiro` — expõe os campos relevantes (limite, disponível, utilizado, vencido, média de atraso, bloqueio de venda).
- Cache razoável (ex: algumas horas) para não sobrecarregar o SOAP a cada abertura de tela.

**Fora de escopo:** somatório manual de títulos via REST (`titulo-contas-receber`) — descartado em favor do endpoint pronto.

**Critérios de aceite:** dado financeiro exibido bate com o Radar para amostra de clientes testados manualmente.

---

## OS-BACKEND-37 — Rastreio: percurso completo + fila offline robusta

**Escopo:** confirmar que `LocalizacaoUsuario` grava todos os pontos (não sobrescreve); `GET /admin/rastreio/:vendedorId/percurso?data=` retornando pontos ordenados; `POST /rastreio/lote` aceitando lotes grandes (centenas de pontos acumulados offline) sem rejeitar por tamanho.

**Critérios de aceite:** consulta retorna todos os pontos do dia em ordem; lote grande é aceito sem erro.

---

## OS-BACKEND-38 — Configurável: janela de reprocessamento de nota fiscal

**Escopo:** expor tamanho da janela (hoje fixo em 60 dias) como campo editável na mesma estrutura de configuração da OS-BACKEND-15, distinto do campo de cadência. Padrão continua 60 dias.

**Critérios de aceite:** alterar a janela via config muda o período reprocessado na próxima execução, sem deploy.

---

## OS-BACKEND-39 — Relatório diário — *(já coberto pela OS-BACKEND-31, remover duplicidade se existir)*

---

## OS-BACKEND-40 — Mapeamento de casos de uso de IA (documentação)

**Objetivo:** entregável é um documento (`docs/casos-de-uso-ia.md`), não código. Mapear: (1) já implementado — resumo de cliente via LLM (OS-BACKEND-20, aguardando chave/OmniRoute), ruptura de estoque por regra estatística; (2) viável com dado atual; (3) precisaria de dado adicional. Evitar sugerir IA onde regra determinística resolve melhor.

---

## OS-BACKEND-41 — Módulo de documentos para consulta

**Escopo:** tabela `Documento` (nome, categoria, caminho, tamanho, enviadoPor, criadoEm). Armazenamento em disco com volume persistente (suficiente para arquivo institucional, sem precisar de object storage). `POST /admin/documentos` (upload, admin), `GET /documentos` (listagem, todos autenticados), `GET /documentos/:id/download`. Validar tipo de arquivo permitido (PDF, imagem, planilha).

**Critérios de aceite:** upload/listagem/download funcionam; tipo não permitido é rejeitado com mensagem clara.

---

## OS-BACKEND-42 — Auditoria da sincronização incremental por entidade

**Escopo:** usando `GET /admin/sync/:nomeEntidade/logs` (OS-BACKEND-16), verificar por entidade: cadência configurada, última execução, status, volume processado condizente com o esperado. `saldo_estoque` deve ser full refresh (esperado); `nota-fiscal` deve reprocessar 60 dias diariamente (esperado); `produto`/`pedido`/`vendedor` devem rodar 1x/dia sem falha silenciosa.

**Critérios de aceite:** relatório claro por entidade, com qualquer divergência sinalizada explicitamente (não corrigir aqui, só diagnosticar).

---

## OS-BACKEND-43 — Download de boleto e PDF/XML de nota fiscal (nova)

**Objetivo:** permitir que o vendedor envie boleto ou nota fiscal ao cliente direto pelo app, sem abrir o ERP.

**Fonte:** `DownloadBoleto` (SOAP `Financeiro.svc`, via `BuscarTokenBoleto` + `DownloadBoleto`) e `DownloadPDFNFe`/`DownloadXMLNFeNFSe` (SOAP `Comercial.svc`, via `BuscarTokenPDFNFe`/`BuscarTokenXMLNotas`).

**Escopo:**
- `GET /titulos/:id/boleto` — obtém token via `BuscarTokenBoleto`, baixa o PDF via `DownloadBoleto`, retorna o arquivo (ou stream) para o app/web.
- `GET /notas-fiscais/:id/pdf` — mesmo padrão via `BuscarTokenPDFNFe` + `DownloadPDFNFe`.
- Não persistir os PDFs no seu banco — buscar sob demanda a cada solicitação (evita ficar com cópia desatualizada).

**Critérios de aceite:** boleto e PDF de nota fiscal baixados batem com o que o Radar gera diretamente.

---

# WEB (Next.js)

## OS-WEB-25 — Assistente de importação via Swagger

**Status:** não implementado. **Escopo:** formulário com URL do Swagger → exibe rascunho gerado pela OS-BACKEND-30 → permite revisão antes de aplicar (nunca automático). **Critério:** aviso de "rascunho, revisar" visível e não ignorável.

---

## OS-WEB-22 — Cadastro/consulta de produto com cálculo POC/RET/KM (desbloqueada)

**Escopo:** badge de `tipoVenda` (POC/RET/KM) na tela de produto; campo de simulação chamando `POST /produtos/:id/calcular` (OS-BACKEND-24) antes de qualquer pedido de verdade.

**Critério de aceite:** simulação bate exatamente com o backend, sem lógica duplicada no front.

---

## OS-WEB-28 — Correção: navegação sem reload/scroll-reset

**Diagnóstico:** buscar `<a href=` apontando para rotas internas (deveria ser `next/link`/`router.push`); listas com `key` instável causando remount completo. **Escopo:** corrigir em todas as telas administrativas (não só uma).

**Critério:** filtro, paginação, edição inline e aprovação não recarregam a página nem resetam scroll.

---

## OS-WEB-29 — Diagnóstico e correção: erro na aba Painel

**Diagnóstico:** reproduzir e capturar stack trace real do backend; candidato mais provável é divisão por zero/erro de agregação em `GET /dashboard/*` quando não há dado no período. **Escopo:** tratamento defensivo em todos os endpoints de dashboard, não só o que causou o erro.

**Critério:** aba Painel carrega sem erro em qualquer filtro de período, inclusive vazio.

---

## OS-WEB-30 — Correção: formatação de telefone do cliente

**Escopo:** localizar componente(s) que exibem telefone e formatar `(DDD) NÚMERO`, tratando array de múltiplos telefones.

**Critério:** telefone formatado em toda tela onde aparece, inclusive múltiplos números.

---

## OS-WEB-31 — Revisão da tela de cliente (estatísticas, períodos, financeiro)

**Escopo:** corrigir exibição de estatísticas (OS-BACKEND-35); adicionar seletor de 1 e 6 meses; adicionar seção de informações financeiras consumindo `GET /clientes/:id/financeiro` (OS-BACKEND-36, agora via `BuscarPosicaoFinanceira`).

**Critério:** estatísticas, ticket médio, total geral, vendedor responsável e dados financeiros corretos na tela.

---

## OS-WEB-32 — Painel de rastreio com percurso completo

**Escopo:** trocar marcador único por polyline usando `GET /admin/rastreio/:vendedorId/percurso` (OS-BACKEND-37); manter filtro por vendedor/data existente.

**Critério:** selecionar vendedor + data desenha o trajeto completo do dia.

---

## OS-WEB-33 — Painel de check-ins e visitas (revisão do supervisor)

**Escopo:** `/admin/visitas` — lista por vendedor/cliente/período com status; detalhe mostrando foto do check-in, coordenadas, distância até o pin; visitas canceladas destacadas com comentário. Restrito à equipe do supervisor (OS-BACKEND-22); gerente/admin veem tudo.

**Critério:** escopo por hierarquia correto; foto e metadados EXIF exibidos; cancelamento visível e consultável.

---

## OS-WEB-34 — Painel administrativo de relatório diário de pedidos

**Escopo:** `/admin/relatorio-pedidos` — pedidos agrupados por vendedor, destacando pendentes há mais de 1 dia. Filtro por vendedor/status/período com escopo por hierarquia.

**Critério:** escopo correto; pendente recorrente destacado.

---

## OS-WEB-35 — Verificar dependência da skill de front-end na UI

**Passos:** desabilitar a skill `frontend-design`, rodar build/dev, navegar por todas as telas, confirmar que nada quebra (tokens estão hardcoded em `globals.css`/`src/components/design/`, não deveriam depender da skill em runtime).

**Critério:** UI idêntica com ou sem a skill ativa.

---

## OS-WEB-36 — Atualização de UI conforme design mais recente

**Escopo:** revisar todas as telas (`clientes`, `estoque`, `notas-fiscais`, `painel`, `pedidos`, `produtos`) contra os componentes/tokens mais recentes de `src/components/design/`.

**Critério:** consistência visual completa entre todas as telas do painel.

---

## OS-WEB-37 — Gráficos de ranking maiores e horizontais

**Escopo:** trocar gráficos de top clientes/produtos/vendedores de barra vertical para horizontal, largura total do container. Verificar se `GET /dashboard/ranking` já cobre vendedor; se não, pequeno ajuste no backend antes.

**Critério:** os três rankings em barra horizontal, largura total, legíveis.

---

## OS-WEB-38 — Painel de gestão de documentos

**Escopo:** `/admin/documentos` — upload, categoria, listagem com remover/substituir, consumindo OS-BACKEND-41.

**Critério:** upload/listagem/remoção funcionam; documento enviado aparece disponível no mobile imediatamente.

---

# MOBILE (Flutter)

Implementado até OS-MOBILE-13 (bootstrap, autenticação, telas base: cliente, produto, pedido, estoque). Seguir a partir daqui.

## OS-MOBILE-14 — Home orientada a ação e hierarquia visual nas listas

**Escopo:** home mostrando resumo do dia (pedidos recentes, alertas de estoque baixo) em vez de menu de atalhos; indicador de cor por situação de pedido e faixa de saldo de estoque nas listagens; estados de vazio/erro/sem conexão com mensagem e ação em todas as listagens.

---

## OS-MOBILE-15 — Busca e favoritos unificados

**Escopo:** campo de busca sempre visível consumindo `GET /busca` (OS-BACKEND-18); resultados agrupados por tipo; favoritos locais (sem endpoint novo).

---

## OS-MOBILE-16 — Infraestrutura de notificações push (Android)

**Escopo:** Firebase Cloud Messaging (`google-services.json` já configurado); registro/atualização de token no login (`DispositivoUsuario`, OS-BACKEND-19); navegação correta ao tocar (pedido, aprovação, visita cancelada, relatório diário); tela de configuração ligar/desligar tipos.

---

## OS-MOBILE-17 — Roteiro e mapa de visitas

**Escopo:** mapa com clientes da carteira (endereços já sincronizados) e agenda do dia (`GET /visitas`). Sem roteirização otimizada nesta fase.

---

## OS-MOBILE-18 — Resumo de carteira do cliente (IA)

**Escopo:** card no detalhe do cliente exibindo resumo da OS-BACKEND-20 (aguardando chave de API/OmniRoute); loading e fallback tratados.

---

## OS-MOBILE-20 — Rastreio de localização em background (Android) com percurso offline

**Escopo:** captura periódica via `WorkManager`; fila local persistente acumulando pontos offline sem perda; envio em lote via `POST /rastreio/lote` (OS-BACKEND-37) assim que houver qualquer conexão (wifi ou dados móveis); intervalo configurável; atenção a fabricantes com gerenciamento agressivo de bateria (orientar liberar exceção). Sem restrição de horário de envio.

---

## OS-MOBILE-21 — Check-in/checkout de visita (especificação completa validada)

**Escopo confirmado pelo usuário, já validado como especificação correta:**
- Botão para registrar pin de localização atual do cliente no mapa (`PATCH /clientes/:id/localizacao`).
- Check-in/checkout só permitidos dentro de raio de 50m do pin cadastrado.
- Check-in exige foto da fachada **exclusivamente via câmera nativa do app** — nenhuma opção de galeria em nenhum momento da UI.
- Validação de data/hora da foto (EXIF) contra o momento do check-in, para evitar foto antiga ou GPS falso — validação no backend já implementada (OS-BACKEND-28); a garantia de "nunca galeria" só é possível na UI do app, deve ser implementada aqui.
- Cancelamento de check-in com comentário obrigatório, notificando o supervisor via push.

**Critérios de aceite:**
- Check-in/checkout bloqueados fora do raio de 50m.
- Nenhuma opção de galeria em nenhum ponto da captura de foto — só câmera direta.
- Cancelamento com comentário chega corretamente ao supervisor.

---

## OS-MOBILE-22 — Sincronização offline completa

**Escopo:** banco local (SQLite via `drift`/`sqflite` ou Hive) populado por `GET /mobile/snapshot` (OS-BACKEND-29); fila de ações pendentes com id local único (idempotência), enviada via `POST /mobile/fila-pendente`; indicador visual de "pendente" até confirmação.

**Substitui integralmente** qualquer versão anterior mais simples de cache — não implementar as duas.

---

## OS-MOBILE-23 — Criação de pedido no app (bloqueada por OS-BACKEND-25)

**Escopo:** selecionar cliente (só da própria carteira) → adicionar produtos com entrada adaptada ao `tipoVenda` (OS-BACKEND-24), chamando `POST /produtos/:id/calcular` em tempo real; campo de desconto com aviso se ultrapassar o limite; pedido offline entra na fila da OS-MOBILE-22.

**Critérios de aceite:** cálculo exibido bate exatamente com o backend; desconto acima do limite avisa antes de confirmar.

---

## OS-MOBILE-24 — Escopo de clientes por vendedor

**Escopo:** listagem já escopada pelo backend (OS-BACKEND-23); tela de verificação de conflito (`GET /clientes/verificar-conflito`) ao prospectar por CPF/CNPJ.

---

## OS-MOBILE-25 — Métricas de cliente no detalhe

**Escopo:** exibir estatísticas (OS-BACKEND-35) e histórico de visitas (OS-BACKEND-28) no detalhe do cliente do app.

---

## OS-MOBILE-26 — Notificação e fluxo de aprovação de desconto

**Escopo:** vendedor recebe status/notificação; supervisor/gerente aprova/rejeita pelo próprio celular (tela de aprovações pendentes).

---

## OS-MOBILE-27 — Tela e notificação de relatório diário

**Escopo:** tela "Meus pedidos do dia" consumindo `GET /pedidos/relatorio-diario` (OS-BACKEND-31); indicador visual para pendente há mais de um dia; notificação push abre direto na tela.

---

## OS-MOBILE-28 — Tratamento de erro e camuflagem de telas do WebView

**Escopo:** interceptar erros do WebView usado no login (OS-MOBILE-12) e mostrar tela de erro nativa do app em vez da tela padrão do navegador; ocultar chrome/barra de URL durante o fluxo de login; timeout tratado com mensagem clara.

**Critérios de aceite:** erro de rede no login mostra tela do app, nunca a tela nativa do WebView; sem barra de URL visível; timeout tratado.

---

## OS-MOBILE-29 — Validação ponta a ponta do push do Firebase

**Roteiro de teste (não é feature nova):** app em foreground/background/fechado recebendo e navegando corretamente; token expirado sendo re-registrado automaticamente sem novo login; dispositivo sem Google Play Services não trava o app.

**Critério:** cada cenário documentado como passou/falhou com evidência.

---

## OS-MOBILE-30 — Atualização de UI conforme novo design system

**Escopo:** revisar `app_theme.dart`/`app_colors.dart` contra os tokens atuais do web; auditar telas já implementadas em busca de inconsistência.

---

## OS-MOBILE-31 — Diagnóstico e correção: estabilidade de conexão

**Passos de diagnóstico:** confirmar se existe retry com backoff exponencial nas chamadas HTTP; investigar se "não conecta direto e sem container" indica o app tentando resolver endereço interno da empresa inacessível de fora (mesma causa da OS-MOBILE-32); checar timeout do client HTTP.

**Escopo:** implementar retry com backoff; se a causa for endereço interno, a correção real é infraestrutura (OS-MOBILE-32), não mascarar com mais retry; feedback visual claro de offline.

**Critério:** app reconecta automaticamente sem exigir reabertura; causa raiz documentada e corrigida na origem.

---

## OS-MOBILE-32 — Configuração do app para acesso fora da rede interna da empresa

**Pré-requisito:** domínio público do backend configurado no servidor (Cloudflare Tunnel + Access, já recomendado anteriormente) — esta OS fica bloqueada até isso existir.

**Escopo:** trocar URL base do endereço interno para o domínio público; testar fluxo de autenticação completo dentro do WebView (ponto de atenção: fluxos de Cloudflare Access podem assumir browser completo, não WebView embutido); variável de build para alternar entre URL interna (dev) e pública (produção).

**Critério:** app funciona fora da rede wifi da empresa (dados móveis e wifi doméstico); login completo funcional fora da rede.

---

## OS-MOBILE-33 — Diagnóstico: SocketException no Android

**Passos:** capturar stack trace completo e mensagem exata (`Connection refused`, `timed out`, `No route to host`, etc.); correlacionar com OS-MOBILE-31/32 — se for host interno inacessível de fora, é a mesma causa raiz; verificar se acontece em request específico ou geral; verificar se é específico de fabricante/versão Android.

**Critério:** causa raiz documentada com stack trace e cenário de reprodução; erro resolvido no cenário identificado.

---

## OS-MOBILE-34 — Aba de documentos para consulta

**Escopo:** tela "Documentos" listando itens (nome, categoria, tamanho, data); download com progresso e cache local; consome OS-BACKEND-41.

---

## OS-MOBILE-35 — Atualização automática do app (OTA) — só código Dart

**Escopo:** avaliar/integrar Shorebird para patches de código Dart sem passar pela loja. Mudança de código nativo (permissão, versão de SDK) **sempre** exige publicação tradicional — isso é limitação de plataforma, não escolha de implementação, e deve ficar documentado.

**Critério:** mudança simples de texto/lógica Dart é aplicada nos dispositivos já instalados sem nova instalação via loja; mudança nativa é claramente identificada como exigindo publicação tradicional.

---

## OS-MOBILE-36 — Diagnóstico: fila "aguardando envio" sem enviar automaticamente

**Passos de diagnóstico:** confirmar se existe listener reativo de conectividade (`connectivity_plus`) disparando o processamento da fila; se existir, verificar se está de fato conectado à função de envio; verificar item travado bloqueando os demais; validar falso negativo de conectividade (testar com request leve, não só status do rádio).

**Escopo:** implementar/corrigir listener reativo disparando envio automático; processamento deve pular item com erro em vez de travar os demais; indicador visual atualizado em tempo real.

**Critério:** reconectar dispara envio automático sem ação manual; item com erro não bloqueia os demais.

---

## OS-MOBILE-37 — Auto-limpeza de cache local **de rotas** (escopo restrito)

**Importante:** esta rotina se aplica **exclusivamente** aos dados de rota/trajeto de rastreio. Estoque, clientes, pedidos e produtos **nunca** são tocados por esta rotina — seguem exclusivamente a sincronização incremental já definida (OS-MOBILE-22/OS-BACKEND-29).

**Escopo:** cache de rota com identificador de versão; ao abrir a tela de rastreio, comparar versão local com a do servidor e atualizar incrementalmente; a função de limpeza deve ter acesso apenas à store de rota, nunca a uma função "limpar tudo" genérica.

**Critérios de aceite:** alteração de rota no servidor reflete no app na próxima sincronização; dados de estoque/clientes/pedidos/produtos permanecem intactos durante e após a rotina (testar explicitamente); cache de rota não é apagado por completo a cada pequena diferença.

---

## OS-MOBILE-38 — Inicialização offline-first (uso sem internet após primeiro login)

**Escopo:** ao abrir o app, verificar sessão salva (OS-MOBILE-12) e dado local (OS-MOBILE-22) — se ambos existem, liberar UI imediatamente sem esperar rede; validação de token em background após UI liberada; janela de tolerância para sessão offline (ex: 7 dias) antes de exigir novo login; sem sessão prévia e sem internet, mostrar mensagem clara (nunca tela em branco); indicador visual persistente de modo offline.

**Critérios de aceite:** usuário com login prévio abre o app em modo avião e navega normalmente; usuário sem login prévio e sem internet recebe mensagem clara; sessão válida nunca é bloqueada esperando rede.

---

## OS-MOBILE-39 — Sincronização em segundo plano (app fechado, Android)

**Escopo:** `WorkManager` agendando verificação periódica de conectividade e processamento da fila pendente mesmo com app fechado; atenção a fabricantes com gerenciamento agressivo de bateria (orientar liberar exceção na tela de configurações); sincronização silenciosa, só notifica em falha persistente.

**Critérios de aceite:** fila processada em segundo plano dentro de intervalo razoável após reconexão, mesmo com app fechado, validado em pelo menos dois fabricantes Android diferentes; nenhuma perda de dado.

---

# Novas funcionalidades sugeridas (fora do escopo original, adicionadas nesta rodada)

Estas OS são propostas de expansão, não pedidas originalmente — priorizar conforme a empresa achar relevante. Todas com componente de IA incorporado onde fizer sentido (marcado explicitamente).

## OS-BACKEND-44 — Metas e gamificação leve por vendedor

**Objetivo:** meta mensal por vendedor com progresso visível, ranking interno opcional, e indicador de consistência (visitas/pedidos regulares).

**Escopo:**
- Tabela `MetaVendedor` (vendedorId, mesAno, valorMeta), configurável pelo admin/supervisor.
- `GET /vendedores/:id/meta-progresso` — valor vendido no mês vs meta, calculado a partir de `Pedido` já sincronizado.
- `GET /equipe/ranking?mesAno=` — ranking da equipe por valor vendido, visível só para supervisor/gerente decidir se expõe ao vendedor comum (flag de configuração).
- Indicador de "streak" — dias/semanas consecutivas com pelo menos uma visita ou pedido registrado.

**Fora de escopo:** qualquer recompensa financeira automática — é só visibilidade e progresso.

**Critérios de aceite:** progresso de meta reflete corretamente os pedidos do mês; ranking respeita a flag de visibilidade configurada.

---

## OS-BACKEND-45 — Alertas proativos de oportunidade (com justificativa por IA)

**Objetivo:** identificar clientes que merecem atenção do vendedor agora, com uma frase de contexto gerada por IA explicando o porquê.

**Escopo:**
- Regra determinística (não-IA) decidindo **quem** entra na lista: cliente sem pedido há N dias (configurável), cliente com padrão de recompra de um produto específico próximo do intervalo esperado, aniversário de relacionamento comercial (data do primeiro pedido).
- `GET /vendedores/:id/oportunidades` — retorna a lista com os dados brutos (cliente, motivo estrutural, última interação).
- Para cada item da lista, chamada a LLM (reaproveitando a infraestrutura da OS-BACKEND-20/OmniRoute) gerando uma frase curta de contexto — ex: "Cliente comprava cabo X a cada 45 dias em média, já se passaram 60 dias desde a última compra." O prompt deve receber só os dados já calculados pela regra, nunca decidir sozinho quem entra na lista (evita alucinação de prioridade).
- Cache do texto gerado (ex: 24h) para não gerar custo a cada abertura de tela.

**Critérios de aceite:** lista de oportunidades reflete corretamente a regra determinística; frase de contexto é coerente com os dados reais do cliente, sem inventar número que não foi fornecido no prompt.

---

## OS-BACKEND-46 — Repetir pedido anterior com sugestão de produto complementar (IA)

**Objetivo:** permitir reordenar um pedido antigo com um toque, com sugestão opcional de produto complementar.

**Escopo:**
- `POST /pedidos/:id/duplicar` — cria um rascunho de novo pedido com os mesmos itens do pedido de referência, para o vendedor revisar/ajustar antes de confirmar (depende da criação de pedido, OS-BACKEND-25, estar desbloqueada).
- `GET /pedidos/:id/sugestao-complementar` — chamada a LLM com o histórico de compra **daquele cliente específico** (nunca do catálogo geral), sugerindo 1-2 produtos que ele costuma comprar junto mas não estão no pedido atual. Puramente sugestão — nunca adicionado automaticamente ao pedido.

**Fora de escopo:** aplicar a sugestão sem ação explícita do vendedor.

**Critérios de aceite:** pedido duplicado replica corretamente os itens originais; sugestão complementar é baseada só no histórico do cliente em questão, nunca de outros clientes.

---

## OS-BACKEND-47 — Assinatura digital de pedido

**Objetivo:** confirmação de pedido com assinatura touch do cliente, gerando PDF para envio.

**Escopo:**
- Campo de assinatura capturado no momento da confirmação do pedido (imagem/traço), armazenado vinculado ao pedido.
- Geração de PDF do pedido com a assinatura embutida (usar skill de PDF do ambiente de implementação).
- Endpoint para reenvio do PDF (ex: por e-mail ou preparado para compartilhar via WhatsApp, reaproveitando a integração da OS-BACKEND-22 original se implementada).

**Critérios de aceite:** assinatura capturada é armazenada corretamente vinculada ao pedido; PDF gerado inclui a assinatura de forma legível.

---

## OS-BACKEND-48 — Substituição temporária de carteira (com resumo de handoff por IA)

**Objetivo:** permitir que um vendedor assuma temporariamente a carteira de outro (férias, licença), com resumo gerado por IA para acelerar a adaptação.

**Escopo:**
- Tabela `CoberturaTemporaria` (vendedorOriginalId, vendedorSubstitutoId, dataInicio, dataFim) — durante o período, o escopo de clientes (OS-BACKEND-23) passa a incluir também a carteira coberta.
- Ao iniciar a cobertura, `GET /coberturas/:id/resumo` chama LLM para gerar, por cliente da carteira coberta, um resumo curto (última compra, ticket médio, algum ponto de atenção recente) — reaproveita o mesmo padrão de prompt da OS-BACKEND-20, aplicado em lote.
- Ao fim do período, a carteira volta automaticamente ao vendedor original.

**Critérios de aceite:** vendedor substituto enxerga a carteira coberta só durante o período configurado; resumo de handoff reflete dados reais de cada cliente, sem inventar informação.

---

## OS-BACKEND-49 — Análise sazonal com insight textual (IA)

**Objetivo:** comparação de período (mês atual vs mesmo mês ano anterior) e detecção de sazonalidade de produto, com insight em texto gerado por IA.

**Escopo:**
- `GET /dashboard/sazonalidade?produtoId=` — calcula, a partir do histórico de `Pedido` já sincronizado, a variação de vendas por mês ao longo dos últimos 12+ meses (cálculo determinístico, não-IA).
- Chamada a LLM recebendo só os números já calculados, gerando 2-3 frases de insight acionável (ex: sugestão de reforçar estoque antes de um pico identificado). O prompt não pode inventar dado — só interpretar o que foi calculado e fornecido.
- Cache do texto gerado por produto/período (ex: semanal, já que o padrão sazonal não muda de um dia pro outro).

**Critérios de aceite:** cálculo de variação está correto e auditável independente da IA; texto gerado reflete fielmente os números calculados, sem número inventado.

---

## OS-BACKEND-50 — Contexto de IA na aprovação de desconto

**Objetivo:** dar ao supervisor/gerente contexto rápido ao decidir uma solicitação de desconto acima do limite.

**Escopo:**
- Ao abrir uma `SolicitacaoDesconto` (OS-BACKEND-22) para decisão, `GET /solicitacoes-desconto/:id/contexto` monta um resumo via LLM com: histórico de descontos desse vendedor (frequência, percentual médio), se esse cliente específico costuma solicitar desconto alto, e como esse pedido se compara à média da equipe — todos os números vêm calculados previamente (não-IA), a LLM só organiza em texto.
- Exibido como card informativo na tela de aprovação (OS-WEB-21 e OS-MOBILE-26), nunca como decisão automática.

**Critérios de aceite:** contexto exibido reflete dados reais e verificáveis; a decisão de aprovar/rejeitar continua 100% humana, sem nenhum caminho de aprovação automática por IA.

---

---

## OS-WEB-39 — Mapa de calor de vendas por região

**Objetivo:** visualizar onde a empresa vende mais/menos por região/cidade.

**Escopo:** reaproveitar o mapa já usado no painel de rastreio (OS-WEB-24/32), trocando a camada de trajeto por um mapa de calor calculado a partir do endereço do cliente (já sincronizado) × valor total de pedidos no período selecionado. Filtro de período compartilhado com o resto do dashboard.

**Critérios de aceite:** intensidade do mapa de calor reflete corretamente o volume de vendas por região no período selecionado.

---

## OS-WEB-40 — Comparativo multi-métrica de vendedores (gráfico radar)

**Objetivo:** comparar vendedores em várias métricas simultaneamente, não só valor total vendido.

**Escopo:** gráfico radar/spider com eixos: valor vendido, ticket médio, taxa de aprovação de desconto (percentual de pedidos aprovados direto vs que precisaram de aprovação), quantidade de visitas realizadas — todos já calculáveis a partir dos dados existentes (`Pedido`, `SolicitacaoDesconto`, `Visita`). Seleção de até 3-4 vendedores para comparar ao mesmo tempo.

**Critérios de aceite:** cada eixo reflete corretamente o dado do vendedor no período selecionado; comparação funciona com 2 a 4 vendedores simultâneos.

---

## OS-WEB-41 — Funil visual de status de pedidos

**Objetivo:** identificar visualmente onde os pedidos estão "empacando" no processo.

**Escopo:** gráfico de funil com as etapas: criado → aguardando aprovação → aprovado → enviado ao ERP → faturado, mostrando quantidade de pedidos em cada etapa no período selecionado. Clique em uma etapa filtra a lista de pedidos correspondente.

**Critérios de aceite:** quantidade em cada etapa do funil bate com a contagem real de pedidos naquele status no período.

---

## OS-WEB-42 / OS-MOBILE-40 — Timeline do relacionamento com o cliente

**Objetivo:** visualização cronológica única combinando pedidos, visitas e mudanças de status no detalhe do cliente, em vez de listas separadas.

**Escopo (web e mobile, mesma lógica de dados):**
- Endpoint agregador (`GET /clientes/:id/timeline`) combinando `Pedido` (criação e mudanças de status via OS-BACKEND-33), `Visita` (check-in/checkout) e notas fiscais relacionadas, ordenados cronologicamente.
- Componente de timeline visual no detalhe do cliente (web: `OS-WEB-31`; mobile: `OS-MOBILE-25`), com ícone distinto por tipo de evento.

**Critérios de aceite:** timeline reflete corretamente a ordem cronológica real dos eventos, sem duplicar dado já mostrado em outras seções da tela.

---

## OS-MOBILE-41 — Indicadores visuais na home do app

**Objetivo:** dar mais vida visual à home (hoje predominantemente texto e lista).

**Escopo:**
- Meta do mês (OS-BACKEND-44) exibida como medidor circular (gauge), não só número.
- Saldo de estoque do(s) produto(s) mais acessado(s) pelo vendedor como barra de progresso colorida direto na home.
- Mini gráfico (sparkline) de evolução de vendas do próprio vendedor nas últimas semanas.

**Critérios de aceite:** indicadores refletem dados reais e atualizados; performance da home não é impactada por esses componentes visuais (evitar recálculo pesado a cada abertura).

---

## OS-MOBILE-42 — Timeline visual de status do pedido

**Objetivo:** vendedor entende de relance em que fase o pedido está, sem interpretar texto de status.

**Escopo:** stepper visual no detalhe do pedido: criado → aguardando aprovação → aprovado/rejeitado → enviado ao ERP → faturado, consumindo o histórico da OS-BACKEND-33. Reaproveitar o mesmo padrão de stepper já usado em outras telas do app.

**Critérios de aceite:** stepper reflete corretamente o status atual e o histórico de transições do pedido.

---

# Observações finais para quem for implementar

1. **OS-BACKEND-24 e OS-MOBILE-23 estão desbloqueadas** — a regra de negócio foi definida nesta rodada. Só falta confirmar com o Radar se `precoVenda` de POC vem já "por peça" (marcado como pendência dentro da OS-BACKEND-24).
2. **OS-BACKEND-25 e OS-MOBILE-23 (parte de envio real) seguem bloqueadas** pelos 6 IDs de referência — não implementar a chamada real ao ERP até esses valores chegarem; o fail-closed já existente deve ser mantido.
3. **OS-MOBILE-31, 32 e 33 têm alta chance de serem o mesmo problema raiz** (host interno inacessível fora da rede da empresa) — investigar como um problema único antes de tratar como três bugs separados.
4. **OS-MOBILE-37 tem restrição de segurança explícita**: a limpeza de cache nunca deve tocar em estoque/clientes/pedidos/produtos — só rota.
5. **Todas as OS mobile assumem Android apenas** — qualquer menção a iOS foi removida por decisão do usuário.
6. **OS-BACKEND-44 a 50 são expansões sugeridas**, não pedidas na especificação original — priorizar conforme a empresa achar relevante. Todas as que usam IA (45, 46, 48, 49, 50) seguem o mesmo princípio: a decisão/regra continua determinística no código, a IA só entra para gerar texto explicativo a partir de dados já calculados — nunca decide sozinha quem entra numa lista, quem é aprovado, ou o que é adicionado a um pedido.
7. **OS-WEB-39 a 42 e OS-MOBILE-40 a 42 são recursos visuais adicionais**, também expansões sugeridas — todos reaproveitam dados já sincronizados, sem exigir nova sincronização de entidade.
