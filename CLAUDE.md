# Contexto do Projeto

## Stack
- **Back-end**: NestJS (TypeScript)
- **Front-end**: Next.js (React, TypeScript)
- **Mobile**: Flutter (Dart)
- **Autenticação**: SSO centralizado via IdP interno, consumido através da lib `@copperline/idp-client`
- **Banco de dados**: PostgreSQL como fonte de verdade (relacional, usa JSONB quando faz sentido para dados flexíveis)
- **Cache/Filas**: Redis — usado para cache, sessões, filas (BullMQ integrado ao NestJS) e rate limiting
- **Estilo (front-end)**: Tailwind CSS
- **Identidade visual (web + mobile)**: tokens de cor/tipografia/espaçamento/componentes definidos na skill `design-system` — fonte única, aplicada tanto no Next.js (via `tailwind.config`) quanto no Flutter (via `ThemeData`/constantes)
- **Dados/Análise**: Python + ECharts para visualizações

## Convenções gerais
- TypeScript em modo estrito no back e no front. Evitar `any`.
- No NestJS: seguir a arquitetura modular padrão (module / controller / service / DTO). DTOs validados com `class-validator`.
- Filas com BullMQ: nomear processors e jobs de forma explícita (ex: `email.send`, `report.generate`).
- Redis: usar prefixos de chave por domínio (ex: `session:*`, `cache:user:*`, `rate:*`) para evitar colisão.
- ORM: Prisma. Migrations via `prisma migrate dev`, schema único em `schema.prisma`. Evitar SQL cru; usar `$transaction` para escritas relacionadas.
- No Next.js: preferir Server Components quando não houver necessidade de interatividade no cliente. Tailwind como única fonte de estilo (evitar CSS solto). Front-end é cliente da API NestJS — Server Components/Server Actions buscam e mutam dados via `fetch` para a API, nunca acessando Postgres/Prisma/Redis diretamente. Route Handlers do Next.js só para necessidades de BFF (agregação, webhook, esconder secret), não como CRUD paralelo. Ver skill `nextjs-best-practices`.
- No Flutter: seguir padrão de widgets pequenos e reutilizáveis; gerenciamento de estado com Riverpod para estado de app/negócio (providers separados da camada de UI, `ConsumerWidget`/`AsyncNotifierProvider`) — nunca usar o pacote `provider`/`ChangeNotifier`. Estado puramente visual e efêmero (animação, expandir/colapsar) pode ficar em `StatefulWidget` local. Para animações, temas, responsividade e performance de UI, ver skill `flutter-ui-ux`.
- Scripts Python de dados: usar ECharts (via `pyecharts` ou exportando JSON de config para o front consumir) em vez de matplotlib quando o gráfico for para consumo web.

## DDD e Clean Code (back-end)
- **Clean Code sempre**: nomes que revelam intenção, funções pequenas com responsabilidade única, sem flags booleanas escondendo comportamento em parâmetros, sem efeito colateral escondido atrás de nome que sugere só leitura/validação.
- **DDD só onde há regra de negócio real.** Critério: o módulo toma decisões/validações com múltiplos cenários que mudam com frequência (ex: conciliação de pedidos, faturamento, cálculos) ou é essencialmente transporte de dados (CRUD simples, sincronização crua fetch/map/upsert)?
  - Com regra de negócio real: a decisão vive numa entidade de domínio (`domain/<recurso>.entity.ts`), sem depender de Prisma/HTTP. O service apenas orquestra — nunca reimplementa a regra.
  - Sem regra de negócio real (sync de ERP simples, CRUD raso): não criar entidade de domínio separada — seria over-engineering.
- Entidades de domínio devem ter teste unitário isolado (sem mock de Prisma/HTTP), validando a regra diretamente.

## Sincronização com sistemas externos (ERP)
O ERP do projeto é o **WK Radar** (módulos Comercial e Empresarial) — escopo atual: pedido, nota-fiscal, cliente, produto (schemas e filtros dos quatro confirmados). Ver skill `wk-radar-client` para autenticação, base de URL e filtros específicos de cada recurso.

Estoque usa um serviço **diferente** do WK Radar (relatórios via `Executivo.svc`, não a API REST — autenticação própria, não reaproveita o `erp-client`) — ver skill `wk-radar-bi-client`. Suporta tanto consulta on-demand (tempo real, sem persistir) quanto sincronização agendada (snapshot completo, sem cursor incremental).

Padrão de referência para qualquer feature que traga dados de um sistema externo para o Postgres:
- `sync.scheduler.ts`: só enfileira jobs via cron (`@nestjs/schedule`), sem lógica de negócio.
- `sync.processor.ts`: `WorkerHost` do BullMQ que consome a fila e delega ao service. Configura `concurrency` para respeitar rate limit do sistema externo.
- `sync.service.ts`: orquestrador — escolhe a strategy da entidade, executa, e é o único ponto que grava em `sync_logs` (início, fim, contagens, erro).
- `<entidade>.sync.ts`: uma strategy por entidade sincronizada, implementando `fetch()`/`map()`/`upsert()`. Adicionar uma nova entidade sincronizada é adicionar um novo arquivo de strategy, sem tocar scheduler/processor/service.
- Chamadas ao sistema externo sempre via módulo dedicado (ex: `erp-client`), nunca HTTP direto na strategy — centraliza auth, headers e retry, e isola o impacto de trocar de fornecedor.
- Convenção de dados: `id` (uuid próprio, nunca reaproveitar o ID externo como PK), `id_externo_erp` (chave do upsert via `ON CONFLICT ... DO UPDATE`), `sincronizado_em`.
- Direção do fluxo é unidirecional (externo → Postgres) por padrão. Escrita de volta ao sistema externo é um fluxo separado, com sua própria fila e tratamento de erro.
- Endpoints administrativos que disparam sync manual ficam atrás de guard (API key ou role) — nunca expostos sem autenticação.

## Autenticação (SSO)
Todo login do parque de sistemas passa pela lib interna `@copperline/idp-client` — nunca reimplementar OAuth2/JWT manualmente.
- Backend NestJS: montar `idpAuth.router` no bootstrap (`main.ts`), proteger rotas por módulo via `MiddlewareConsumer.apply(idpAuth.requireAuth, requireRole(...)).forRoutes(...)`, acessar o usuário autenticado via um decorator `@CurrentUser()` (não `req.user` direto no controller).
- `access_token`/`refresh_token` nunca chegam ao front — ficam só na sessão do backend (`httpOnly`). O Next.js, como cliente da API NestJS, nunca fala com o IdP diretamente.
- `clientSecret` só existe no backend, nunca em `NEXT_PUBLIC_*` nem em código client-side.
- Ver skill `idp-client` para o fluxo completo, configuração e integração detalhada.

## Segurança — 5 vulnerabilidades críticas (checagem obrigatória)
Toda revisão de segurança (`security-review`) e revisão de PR que toque em autorização/dados devem checar nomeadamente:
1. **Banco sem proteção**: acesso ao Postgres sempre via API (nunca direto do front/mobile); considerar RLS nativo como defesa extra em tabelas sensíveis.
2. **Regra de negócio no front-end**: `role`/permissão sempre validado no backend a partir do JWT (`idp-client`) — nunca confiar em dado vindo do client.
3. **IDOR**: todo endpoint com ID de recurso confirma ownership na própria query (`findFirst({ where: { id, userId } })`), não só que o ID existe.
4. **Segredos hardcoded**: sempre env var, nunca commitado — usar Gitleaks para varrer o histórico do Git.
5. **XSS / input sem tratamento**: validação no backend (`class-validator`), sanitização de HTML no servidor, validação real de upload (MIME/tamanho).

Ferramentas de auditoria recomendadas: OWASP ZAP (DAST), Gitleaks (segredos no Git), OpenGrep (SAST). Ver skill `security-review` para o checklist completo por camada.

## Antes de gerar código
Sempre que o padrão de um módulo específico não estiver claro (ORM usado, gerenciador de estado no Flutter, estrutura de pastas, se o módulo precisa de DDD), pergunte ou inspecione o repositório antes de assumir.

## Commits
Fazer commit para o repositorio local ao termino de cada OS
Seguir Conventional Commits (feat, fix, chore, refactor, docs, test, perf). Ver skill `commit-message`.
