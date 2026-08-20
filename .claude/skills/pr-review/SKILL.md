---
name: pr-review
description: Revisa mudanças de código (diff local ou PR) verificando padrões do stack NestJS/Next.js/Flutter, DDD/Clean Code no back-end, o padrão de sincronização com ERP, segurança básica, e uso correto de Postgres/Redis. Use quando o usuário pedir "revisar esse código", "revisar o PR" ou "checar antes de commitar".
---

## Instruções

Ao revisar código, verifique nesta ordem:

### 1. Correção e tipagem
- TypeScript: sem `any` não justificado, tipos de retorno explícitos em funções públicas.
- Dart/Flutter: null-safety respeitada, sem widgets rebuild desnecessário.

### 2. Padrões do stack
- **NestJS**: DTOs validados com `class-validator`/`class-transformer`; controllers finos, lógica no service; erros lançados como exceções HTTP do Nest (`NotFoundException`, etc.), não `throw new Error`. Acesso a dados via Prisma Client — atenção a `include`/`select` desnecessários (over-fetching) e uso de `$transaction` quando há múltiplas escritas relacionadas.
- **Next.js**: Server vs Client Component usado corretamente (`"use client"` só quando necessário); sem fetch duplicado que deveria estar em cache/SSR. Toda leitura/escrita de dados passa pela API NestJS (`fetch`/Server Action) — nunca Prisma/Postgres/Redis chamado direto do Next.js. Route Handlers só para necessidades de BFF (agregação, webhook, esconder secret de terceiro), não como CRUD paralelo ao NestJS. Estilo exclusivamente via Tailwind (sem CSS solto ou CSS-in-JS). Ver skill `nextjs-best-practices` para os padrões completos.
- **Flutter**: separação entre UI e lógica de estado; sem chamadas de rede direto no widget.

### 3. DDD e Clean Code (back-end)
- **Regra de negócio no lugar certo**: se o módulo tem decisões/validações com múltiplos cenários (ex: conciliação, faturamento, cálculos), essa lógica deve estar numa entidade de domínio (`domain/*.entity.ts`), não espalhada no service, controller ou repositório. Se encontrar `if` de regra de negócio dentro de um service que também chama Prisma/HTTP, é um sinal de alerta — sugerir extrair para entidade.
- **Módulos simples não precisam de DDD**: CRUD raso ou sincronização crua (fetch/map/upsert sem decisão) não deve ter entidade de domínio — isso seria over-engineering. Não sugerir DDD onde não há regra de negócio genuína.
- **Clean Code**: nomes de função/variável revelam intenção (não `data`, `handleThing`, `process`); funções fazem uma coisa só; sem flags booleanas escondendo comportamento em parâmetros (`fn(x, true)`); sem efeito colateral escondido atrás de nome que sugere só leitura/validação.
- **Testabilidade**: se existe entidade de domínio com regra de negócio, deve haver teste que a exercita isoladamente (sem mock de Prisma/HTTP) — se não houver, apontar como sugestão.

### 4. Padrão de sincronização com ERP (quando aplicável)
- Fluxo em camadas respeitado: `scheduler` só enfileira, `processor` só consome e delega, `service` orquestra e loga em `sync_logs`, strategies (`<entidade>.sync.ts`) implementam `fetch/map/upsert`.
- Chamadas ao ERP passam pelo `erp-client` module — nunca HTTP direto numa strategy.
- Upsert usa `id_externo_erp` como chave de conflito, nunca o ID do ERP como PK própria.
- Toda sincronização grava em `sync_logs` (contagens, erro, payload de falha) — ausência disso é sinal de alerta, dificulta debug futuro.
- Direção do fluxo é ERP → Postgres; qualquer escrita de volta ao ERP deve estar em fila/tratamento separado, nunca misturada ao pipeline de leitura.

### 5. Banco de dados e cache
- Postgres: queries N+1, falta de índice em coluna usada em WHERE/JOIN frequente, uso de JSONB justificado (não usado como escape de modelagem).
- Redis: chaves com prefixo/domínio claro, TTL definido em dados de cache (evitar chave sem expiração para dado efêmero), jobs BullMQ com nome explícito e tratamento de erro/retry configurado.

### 6. Segurança básica
- Nunca logar dados sensíveis (senha, token, PII).
- Rate limiting aplicado em endpoints públicos sensíveis (login, reset de senha).
- Validação de entrada em todos os DTOs/handlers.
- Autenticação sempre via `idp-client` (`requireAuth`/`requireRole`) — sinal de alerta se aparecer verificação de JWT, geração de `state` CSRF, ou lógica de refresh de token implementada manualmente em vez de usar a lib. Ver skill `idp-client`.
- Para mudanças que tocam autorização, dados de outro usuário, secrets ou input de usuário: checar as 5 vulnerabilidades críticas do projeto (banco sem proteção, regra de negócio no front, IDOR, segredo hardcoded, XSS) — ver skill `security-review` para o checklist completo; se o achado for sério, recomendar rodar `security-review` de fato em vez de só sinalizar aqui.

### 7. Formato da resposta
Liste os achados agrupados por severidade: **Bloqueante**, **Sugestão**, **Nitpick**. Para cada um, aponte o arquivo/linha e uma sugestão concreta de correção. Não reescreva o arquivo inteiro — aponte os pontos.
