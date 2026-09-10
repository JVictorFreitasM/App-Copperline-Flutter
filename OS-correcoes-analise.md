# OS — Correções e Melhorias (a partir da análise do sistema)

Numeração provisória (`OS-BACKEND-XX` / `OS-WEB-XX` / `OS-MOBILE-XX`) — ajustar para a sequência real do backlog antes de abrir. Segue o mesmo padrão de comentário usado no código (contexto + critério de aceite), para servir de referência direta na implementação.

---

## Segurança

### OS-BACKEND-XX — [CRÍTICO] Restringir `/pedidos` a `requireRole('admin')`

**Contexto:** `PedidosModule` aplica só `requireAuth` no `MiddlewareConsumer`, diferente de `ProdutosModule`, `DocumentosModule` e `TabelasPrecoModule`, que encadeiam `requireAuth, requireRole('admin')`. Como `PedidosService.listar()` e `buscarPorId()` não filtram por vendedor/cliente, qualquer usuário autenticado (inclusive vendedor logado só pelo app mobile) consegue listar/ver pedidos de qualquer cliente da empresa via `GET /pedidos` e `GET /pedidos/:id`.

**O que fazer:**
- Adicionar `requireRole('admin')` ao `consumer.apply(...)` de `PedidosModule`, igual aos módulos irmãos.
- Confirmar que nenhum fluxo legítimo do app mobile depende hoje de chamar `PedidosController` diretamente (o vendedor já tem `POST /pedidos` — que é escopado — e `/mobile/snapshot`, que deveria ser o único caminho de leitura do próprio pedido no app). Se existir uso legítimo de um vendedor comum lendo o próprio pedido por essa rota, criar um método de service separado com filtro de escopo (`VendedorEscopoService`) em vez de abrir o `requireRole('admin')`.
- Escrever teste de integração cobrindo: vendedor sem papel admin recebe 403/404 em `GET /pedidos/:id` de um pedido que não é seu.

**Critério de aceite:** vendedor comum autenticado recebe erro de autorização ao chamar `GET /pedidos`, `GET /pedidos/:id` e `GET /pedidos/:id/historico`; painel admin continua funcionando normalmente para usuário com papel `admin`.

**Prioridade:** Crítica — corrigir antes de qualquer outro item desta lista.

---


### OS-BACKEND-XX — Configurar CORS explícito em produção

**Contexto:** `main.ts` não chama `app.enableCors(...)`, deixando a política de CORS implícita. Hoje não é explorável porque front e back não trocam requests cross-origin fora do fluxo esperado, mas é uma lacuna silenciosa: se outro client passar a chamar a API direto do navegador de outra origem, ou se um subdomínio for comprometido, a ausência de configuração explícita vira brecha sem aviso.

**O que fazer:**
- Adicionar `app.enableCors({ origin: [FRONTEND_PUBLIC_URL], credentials: true })` (ou lista de origens permitidas via env var), nunca `origin: '*'` em rota autenticada.
- Documentar no `README.md` do backend que qualquer novo client (ex. app web futuro) precisa ser adicionado explicitamente à lista.

**Critério de aceite:** requisição autenticada a partir de uma origem fora da lista permitida é bloqueada pelo navegador (preflight falha); fluxo atual do painel admin continua funcionando sem alteração perceptível.

**Prioridade:** Média.

---

### OS-BACKEND-XX — Ampliar cobertura de rate limiting em rotas sensíveis

**Contexto:** `RateLimitGuard` já está corretamente implementado sobre Redis (compartilhado entre instâncias), mas hoje só protege `cliente-resumo-llm` e `estoque`. Login/SSO é delegado ao `idp-client` (fora deste repo), mas outras rotas que chamam serviços externos caros ou sensíveis (ex. `simular-desconto`, importação de swagger em `admin/endpoints`) não têm limite.

**O que fazer:**
- Levantar, junto ao time, quais endpoints chamam serviços externos pagos/rate-limited ou são potencialmente sensíveis a abuso (ex. envio de notificação, importação de swagger, criação de pedido em massa).
- Aplicar `@RateLimit(...)` + `RateLimitGuard` nesses endpoints, seguindo o padrão já existente.
- Confirmar com o time do IdP central se há rate limit em tentativas de login/OTP (fora do escopo deste backend, mas vale registrar como dependência).

**Critério de aceite:** lista de endpoints sensíveis revisada; endpoints identificados como de risco têm `@RateLimit` aplicado com janela/limite documentados no código.

**Prioridade:** Baixa.

---

## Bugs / robustez

### OS-BACKEND-XX — Eliminar fragilidade de ordenação de rotas estáticas vs `:id`

**Contexto:** rotas como `/pedidos/relatorio` e `/produtos/favoritos` dependem de estarem declaradas *antes* de `/:id` no controller para não colidir (Express/Nest casam por ordem de declaração). Já documentado em comentário no código, mas é uma classe de bug que quebra silenciosamente se alguém adicionar uma rota estática nova sem lembrar da regra.

**O que fazer:**
- Levantar todas as rotas do tipo `@Controller('recurso')` que misturam segmentos estáticos com `:id` no mesmo nível.
- Avaliar mover os segmentos estáticos mais sensíveis a erro (`relatorio`, `favoritos`) para um path fixo separado do `:id` (ex. sub-controller ou prefixo dedicado), reduzindo dependência de ordem de declaração.
- Se a mudança de rota for grande demais para o momento, no mínimo adicionar um teste de integração por controller afetado que falha caso a ordem seja invertida por engano.

**Critério de aceite:** pelo menos um teste automatizado por controller afetado garante que a rota estática nunca é interpretada como valor de `:id`.

**Prioridade:** Baixa — mitigação preventiva, sem incidente confirmado até agora.

---


## UX

### OS-MOBILE-XX — Indicador visual de status de sincronização (fila offline)

**Contexto:** o app já suporta ações offline via `FilaPendenteService`, mas a UI não deixa explícito quando um pedido/visita ainda está "pendente de sincronização" vs. "confirmado no servidor" — risco do vendedor achar que já enviou algo que ainda está na fila local.

**O que fazer:**
- Adicionar badge/indicador visual (ex. ícone de nuvem/relógio) em pedidos e visitas com estado "pendente" enquanto não confirmados pelo backend.
- Notificar o vendedor (toast/alerta) quando um item da fila falha ao sincronizar, com opção de retry manual.

**Critério de aceite:** usuário consegue diferenciar visualmente, sem sair da tela de listagem, um pedido/visita local pendente de um já sincronizado.

**Prioridade:** Média.

---

### OS-MOBILE-XX — Preview e opção de refazer foto no check-in de visita

**Contexto:** a foto de fachada é obrigatória no check-in (`validarFotoOuFalhar`), mas hoje o fluxo não confirma visualmente o que foi capturado antes de enviar — problema maior em campo com conexão ruim, onde re-trabalho é caro.

**O que fazer:**
- Adicionar tela de preview da foto capturada antes da confirmação do check-in, com opção "tirar novamente".
- Validar localmente (antes de gastar rede) que a foto não está vazia/corrompida, reaproveitando a mesma regra de `validarFotoOuFalhar` como pré-checagem client-side (sem substituir a validação server-side).

**Critério de aceite:** vendedor visualiza a foto antes de confirmar o check-in e pode refazê-la sem perder os demais dados já preenchidos.

**Prioridade:** Média.

---

### OS-WEB-XX — Indicador explícito de escopo ativo no painel de relatórios

**Contexto:** `RelatorioPedidosService`/`listarEquipe` já aplicam escopo por hierarquia (supervisor vê equipe, admin vê tudo), mas o front não deixa claro qual filtro está ativo — risco de o usuário confundir "não há pedidos" com "não tenho permissão para ver mais".

**O que fazer:**
- Exibir no painel web, de forma visível, o escopo atual (ex. "Vendo: minha equipe" / "Vendo: todos os vendedores"), coerente com o que o backend realmente está aplicando.
- Se o usuário tiver mais de um escopo possível (ex. admin que também é supervisor de uma equipe específica), permitir alternar entre eles explicitamente, refletindo a alternância na query enviada.

**Critério de aceite:** usuário nunca vê uma lista vazia sem indicação textual de qual escopo está sendo aplicado.

**Prioridade:** Baixa.

---

### OS-WEB-XX / OS-MOBILE-XX — Deixar explícito na UI que a simulação de desconto não reserva nada

**Contexto:** existe um fluxo de simulação (`POST /pedidos/simular-desconto`) deliberadamente separado da criação real de `SolicitacaoDesconto` — hoje essa distinção só está documentada em comentário de código, não necessariamente comunicada na interface.

**O que fazer:**
- Adicionar texto/aviso na tela de simulação (web e mobile) deixando claro que nenhuma solicitação é criada nem notificação é disparada até a confirmação do pedido.

**Critério de aceite:** usuário que só simula, sem confirmar, entende que nada foi registrado — validar com teste de usabilidade rápido ou revisão de copy com o time de produto.

**Prioridade:** Baixa.

---

## Novas funcionalidades

### OS-BACKEND-XX — Log de auditoria de acesso administrativo

**Contexto:** decorrente do achado crítico em `/pedidos` — hoje não há trilha de quem acessou qual pedido/cliente e quando, o que dificulta tanto detectar abuso passado quanto validar que a correção de escopo funcionou.

**O que fazer:**
- Registrar em log estruturado (ou tabela dedicada) acessos a recursos sensíveis via rotas administrativas: usuário, recurso acessado, timestamp.
- Definir retenção e quem tem acesso a esse log (o próprio log de auditoria não deve virar uma nova superfície de exposição de dados).

**Critério de aceite:** é possível responder "quem acessou o pedido X e quando" para um período retido, sem precisar de acesso direto ao banco de produção.

**Prioridade:** Média — reforça a correção do item crítico e serve de detecção para casos futuros semelhantes.

---

### OS-BACKEND-XX — Avaliar Row Level Security nativo para tabelas sensíveis

**Contexto:** hoje toda a autorização depende inteiramente da camada de aplicação (NestJS/Prisma). Isso já se provou insuficiente uma vez (achado crítico de `/pedidos`). RLS nativo do Postgres seria uma segunda camada de defesa independente de um bug futuro na API.

**O que fazer:**
- Avaliar `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` para `Pedido`, `Cliente` e `SolicitacaoDesconto`, com política amarrada a uma variável de sessão (`current_setting('app.current_user_id')` ou equivalente) setada pela aplicação a cada conexão/request.
- Fazer prova de conceito em ambiente de staging antes de aplicar em produção, medindo impacto de performance.

**Critério de aceite:** POC documentada com resultado (viável/não viável) e, se viável, plano de rollout faseado por tabela.

**Prioridade:** Baixa — é defesa em profundidade, não bloqueante, mas vale planejar.

---

### OS-WEB-XX — Exportação agendada de relatórios de pedidos

**Contexto:** já existe `RelatorioPedidosService` consumido sob demanda pelo painel web; falta uma opção de exportação/envio periódico.

**O que fazer:**
- Adicionar exportação em PDF/Excel do relatório atual (reaproveitando os mesmos filtros/escopo já aplicados na tela).
- Avaliar agendamento (ex. envio semanal por e-mail a supervisores), reaproveitando a infraestrutura de notificações já existente no backend.

**Critério de aceite:** supervisor consegue exportar o relatório que está vendo na tela com um clique; agendamento (se priorizado) respeita o mesmo escopo de dados do usuário.

**Prioridade:** Baixa — melhoria de valor, não corretiva.

---

### OS-MOBILE-XX — Avaliar certificate pinning para chamadas à API

**Contexto:** o app mobile carrega token de sessão e dados comerciais sensíveis (preços, descontos, dados de clientes) e é usado com frequência em redes de clientes/públicas, onde o risco de MITM é maior do que em rede corporativa.

**O que fazer:**
- Avaliar certificate pinning (ex. via `Dio` + `HttpClientAdapter` customizado) para as chamadas à API de produção.
- Definir processo de rotação do certificado/pin junto ao time de infraestrutura, para não travar o app em produção quando o certificado do backend for renovado.

**Critério de aceite:** POC de pinning funcionando em build de teste; processo de rotação de certificado documentado antes de habilitar em produção.

**Prioridade:** Baixa — reforço de segurança, não bloqueante.

---

## Resumo

| OS | Área | Prioridade |
|---|---|---|
| Restringir `/pedidos` a admin | Backend/Segurança | **Crítica** |
| Girar credenciais do `.env` | Backend/Segurança | Média-Alta |
| CORS explícito | Backend/Segurança | Média |
| Checklist de deploy (API key / cookie domain) | Backend/Robustez | Média |
| Log de auditoria administrativo | Backend/Feature | Média |
| Rate limiting em mais rotas | Backend/Segurança | Baixa |
| Ordenação de rotas | Backend/Bug | Baixa |
| Indicador de sync offline | Mobile/UX | Média |
| Preview de foto no check-in | Mobile/UX | Média |
| Escopo explícito no painel | Web/UX | Baixa |
| Aviso de simulação de desconto | Web+Mobile/UX | Baixa |
| RLS nativo | Backend/Feature | Baixa |
| Exportação agendada de relatórios | Web/Feature | Baixa |
| Certificate pinning | Mobile/Feature | Baixa |
