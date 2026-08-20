---
name: nest-endpoint
description: Gera um endpoint NestJS completo (controller, service, DTO, módulo) seguindo os padrões do projeto, incluindo integração opcional com BullMQ/Redis e Postgres, aplicando DDD quando o módulo tiver regra de negócio real. Use quando o usuário pedir para "criar um endpoint", "criar rota", "criar CRUD", "criar sincronização com ERP" no back-end.
---

## Instruções

1. Confirme apenas o que for específico da feature (se não estiver claro pelo contexto): nome do recurso, verbos HTTP necessários (GET/POST/PUT/DELETE), se precisa de autenticação/guard, se algum passo deve ser assíncrono via fila (BullMQ). Não pergunte sobre ORM — o projeto usa Prisma. Se precisar de autenticação/role, use a lib `idp-client` (`requireAuth`/`requireRole`, montados via `MiddlewareConsumer` no módulo, `@CurrentUser()` no controller) — nunca implemente verificação de JWT manualmente. Ver skill `idp-client`.

2. **Decida se o módulo precisa de DDD antes de gerar o código.** Pergunta-chave: o módulo tem regra de negócio real (decisões, validações com múltiplos cenários, cálculos que mudam com frequência) ou é essencialmente transporte de dados (fetch/map/salvar, CRUD simples)?
   - **Sem regra de negócio real** (CRUD simples, sincronização crua de dados do ERP): siga o passo 3, sem entidade de domínio separada — o service manipula os dados diretamente via Prisma.
   - **Com regra de negócio real** (ex: conciliação de pedidos, faturamento, qualquer fluxo com decisões condicionais sobre estado): crie uma entidade de domínio (`domain/<recurso>.entity.ts`) que encapsula a regra, e o service apenas orquestra — instancia a entidade, chama seus métodos, persiste o resultado via Prisma. Nunca coloque a decisão de negócio direto no service ou no controller. Se tiver dúvida sobre qual caso se aplica, pergunte ao usuário em vez de assumir.

3. Gere, seguindo a arquitetura modular do Nest (e Clean Code: nomes que revelam intenção, funções pequenas e de responsabilidade única, sem flags booleanas em parâmetros — ver seção de Clean Code do projeto):
   - `*.dto.ts` com validação via `class-validator`
   - `domain/*.entity.ts` (apenas se o passo 2 indicar DDD) — contém os métodos que decidem a regra de negócio, sem depender de Prisma, HTTP ou qualquer detalhe técnico
   - `*.controller.ts` fino, delegando para o service
   - `*.service.ts` com a orquestração, injetando `PrismaService`. Se houver entidade de domínio, o service converte entre o formato Prisma e a entidade, e chama os métodos da entidade para decisões — nunca reimplementa a regra
   - `*.module.ts` registrando os providers

4. Se envolver Postgres: usar Prisma como ORM. Alterações de schema vão em `schema.prisma`, seguidas de `prisma migrate dev --name <descricao>`. Não escrever SQL cru nem usar `$queryRaw` a menos que seja explicitamente necessário (ex: query complexa que o Prisma Client não expressa bem).

5. Se envolver cache: usar Redis com chave no padrão `cache:<recurso>:<id>` e TTL explícito.

6. Se a operação for pesada ou não precisar de resposta síncrona (envio de email, geração de relatório, processamento de arquivo, sincronização com sistema externo): mover para um processor BullMQ, nomeando o job como `<recurso>.<acao>` (ex: `report.generate`, `pedidos.sync`).

7. **Se o pedido for especificamente uma sincronização com o ERP**, siga a arquitetura de referência do projeto em vez de um endpoint CRUD comum:
   - `sync.scheduler.ts`: só enfileira jobs via cron (`@nestjs/schedule`), sem lógica.
   - `sync.processor.ts`: `WorkerHost` do BullMQ que consome a fila e delega ao service. Configure `concurrency` para respeitar rate limit do ERP.
   - `sync.service.ts`: orquestrador — escolhe a strategy da entidade, executa, e grava em `sync_logs` (início, fim, contagens, erro). Ponto único de auditoria.
   - `<entidade>.sync.ts`: uma strategy por entidade sincronizada, implementando `fetch()`/`map()`/`upsert()`. Se a entidade tiver regra de conciliação (ex: "pedido faturado não pode virar cancelado"), essa regra vive numa entidade de domínio chamada pela strategy, não dentro do `upsert()`.
   - Chamadas ao ERP sempre via `erp-client` module (nunca HTTP direto na strategy) — centraliza auth, headers e retry.
   - Tabelas geradas por sync sempre têm `id` (uuid próprio), `id_externo_erp` (chave do upsert) e `sincronizado_em`.
   - **Se o ERP for o WK Radar** (pedido, nota-fiscal, cliente, produto): ver skill `wk-radar-client` para autenticação, base de URL, filtros de cada recurso e a estratégia de cursor incremental específica de cada um (eles não são uniformes — pedido e produto usam cursor único, cliente usa range de datas, nota-fiscal não tem cursor de alteração).
   - **Se for consulta/sincronização de estoque**: usa um serviço diferente do WK Radar (relatórios via `Executivo.svc`, não a API REST) — ver skill `wk-radar-bi-client`. Estoque pode ser tanto endpoint on-demand (consulta em tempo real, sem persistir) quanto sincronização agendada (snapshot completo, sem cursor incremental — full refresh a cada execução). Não reaproveitar o módulo `erp-client` da API REST para isso — autenticação e protocolo são diferentes, precisa de módulo próprio (`wk-bi-client`).

8. Sempre incluir tratamento de erro com as exceções nativas do Nest e um teste unitário básico do service (Jest) — e, se houver entidade de domínio, um teste da entidade isolado (sem mock de Prisma/HTTP), validando as regras de negócio diretamente.

9. Ao final, resuma os arquivos criados/alterados e, se aplicou DDD, justifique brevemente por quê (qual regra de negócio motivou a entidade separada).
