---
name: security-review
description: Revisa código em busca de riscos de segurança específicos do stack NestJS, Next.js, Flutter, Prisma/Postgres, Redis e da lib de autenticação SSO idp-client — checando nomeadamente as 5 vulnerabilidades críticas de SaaS (banco sem proteção/RLS, regra de negócio no front, IDOR, segredos hardcoded, XSS/input sem tratamento) e recomendando ferramentas de auditoria (OWASP ZAP, Gitleaks, OpenGrep). Use quando o usuário pedir "revisar segurança", "checar vulnerabilidades", "auditoria de segurança" ou antes de subir código sensível (auth, pagamento, dados pessoais) para produção.
---

## Instruções

Revise o código/diff nesta ordem, apontando achados por severidade (**Crítico**, **Alto**, **Médio**, **Baixo**), com arquivo/linha e sugestão de correção. Não corrija automaticamente sem confirmação quando envolver mudança de comportamento (ex: adicionar guard que pode quebrar um fluxo existente).

## As 5 Vulnerabilidades Críticas (checagem nomeada obrigatória)

Ao revisar, cheque explicitamente cada uma destas cinco por nome — não basta rodar as seções por camada abaixo de forma genérica, confirme e cite cada uma individualmente no resultado, mesmo quando não encontrar problema ("✅ Sem regra de negócio delegada ao front encontrada").

### 1. Banco de dados sem proteção (RLS)
O projeto não usa Supabase/Firebase, então não há um toggle de RLS ligado por padrão — mas o risco equivalente existe: se **qualquer** caminho de acesso ao Postgres não passar pela checagem de autorização da API, o dado fica exposto.
- Confirmar que **nenhum** acesso ao Postgres acontece fora do NestJS (nunca direto do Next.js — ver skill `nextjs-best-practices`; nunca com credenciais expostas ao Flutter).
- Para tabelas com dado sensível (financeiro, PII, multi-tenant): considerar habilitar **Row Level Security nativo do Postgres** como camada extra de defesa (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + política ligada a uma variável de sessão, ex: `current_setting('app.current_user_id')`), mesmo já validando no nível da API — é defesa em profundidade contra um bug de autorização na aplicação (ex: um `findMany` sem filtro de `where` esquecido).
- Usuário de aplicação no Postgres com permissões mínimas (não superuser) — ver seção 2 abaixo.

### 2. Regras de negócio no front-end
Nenhuma decisão de autorização pode depender de algo que o navegador/app mobile controla.
- `role`/permissão sempre lida de `req.user` (claims do JWT já validado pelo `idp-client` via `requireAuth`) no backend — nunca de um campo enviado no body, query string, header customizado, `localStorage`, estado Riverpod ou qualquer coisa client-side.
- O front (Next.js/Flutter) pode esconder um botão de admin por UX, mas o endpoint por trás dele **tem** que ter `requireRole('admin')` — esconder no front sem proteger no back não é proteção nenhuma.
- Sinal de alerta: qualquer `if (user.role === 'admin')` decidindo algo importante que só existe no client, sem o endpoint correspondente também checar.

### 3. IDOR (Insecure Direct Object Reference)
Todo endpoint que recebe um ID como parâmetro (`:id`, body, query) e retorna/altera um recurso **tem que confirmar que o recurso pertence a quem está pedindo**, não só que o ID existe.
- Sinal de alerta: `prisma.pedido.findUnique({ where: { id } })` seguido de retorno direto, sem checar `pedido.userId === req.user.sub` (ou equivalente de tenant/empresa).
- Padrão correto: incluir o dono como parte da própria query — `prisma.pedido.findFirst({ where: { id, userId: req.user.sub } })` — em vez de buscar por ID e validar depois (mais fácil de esquecer o `if`).
- Vale para qualquer recurso "meu": pedidos, documentos, dados de sincronização do ERP vinculados a um cliente/empresa, etc. Testar mentalmente: "o que acontece se eu trocar o ID 105 por 106 na requisição, sendo dono só do 105?"

### 4. Segredos expostos (hardcoded)
- Nenhuma chave de API, senha, token ou secret escrito literalmente no código-fonte — sempre variável de ambiente (`.env`, nunca commitado — confirmar presença no `.gitignore`).
- Isso vale para todo o parque: `clientSecret` do `idp-client`, credenciais de banco, tokens de serviços externos (ERP, provedor de IA), chaves de assinatura de JWT.
- Sinal de alerta ao grep: literais que parecem chave (`sk_`, `AKIA`, `Bearer ey...`, string longa em base64 atribuída a uma constante) em qualquer arquivo versionado.
- Ver seção "Ferramentas de Auditoria" abaixo (Gitleaks) para varredura automatizada do histórico do Git, não só do estado atual.

### 5. Falta de tratamento de inputs (XSS)
- Todo input de usuário validado no backend com `class-validator` (DTOs) — nunca confiar em validação só do lado client.
- Conteúdo vindo de usuário (comentário, nome, campo de texto livre) nunca renderizado sem sanitização — no Next.js, evitar `dangerouslySetInnerHTML` sem passar por um sanitizador (ex: `DOMPurify`); se for permitir HTML/rich text, sanitizar **no servidor**, não só no client (o client pode ser burlado, ex: chamando a API direto sem passar pela UI).
- Upload de arquivo: validar tipo MIME e extensão no backend (não confiar só no `Content-Type` enviado pelo client), limitar tamanho, nunca servir o arquivo enviado com o nome original (evita path traversal e mascarar um `.html`/`.svg` malicioso como imagem).
- Vale tanto para conteúdo exibido a outros usuários comuns quanto — especialmente — a **administradores** (um payload em um campo de "nome de usuário" que executa quando um admin abre o painel é ainda mais grave, pois herda os privilégios de admin).

## Checagem por camada

### A. NestJS / API
- Todo endpoint que muda estado (POST/PUT/PATCH/DELETE) tem guard de autenticação (`requireAuth`/`requireRole` do `idp-client`, montados via `MiddlewareConsumer`), a menos que seja explicitamente público.
- Autorização checada no nível certo (não confiar só em esconder o botão no front) — checar ownership do recurso (ex: usuário só edita o próprio registro), além do `role` já checado por `requireRole`.
- DTOs com `class-validator` em 100% dos inputs; nunca usar o body cru sem validação.
- Rate limiting em endpoints de login, reset de senha, criação de conta, envio de OTP/email — **se implementado em memória** (contador no processo, sem Redis), confirmar se o serviço já roda ou vai rodar em múltiplas instâncias: rate limit em memória com N instâncias atrás de um load balancer multiplica o limite real por N (cada instância tem seu próprio contador). Nesse caso, o contador precisa ir para Redis (compartilhado entre instâncias) — não é opcional a partir do momento em que há mais de uma instância. Documentar a limitação explicitamente enquanto for só uma instância.
- Autenticação: o projeto usa a lib interna `idp-client` (SSO contra o IdP central) — nunca reimplementar verificação de JWT, geração de `state` CSRF, ou lógica de refresh manualmente. Ver skill `idp-client` para o modelo completo (verificação via JWKS, `aud`=`clientId`, sessão só no backend, `clientSecret` nunca no front) e para as limitações conhecidas do lado servidor do IdP (tratamento de `state` no `/authorize`, PKCE só necessário se algum client futuro for público/SPA sem backend — hoje todos são confidenciais).
- Mensagens de erro não vazam detalhes internos (stack trace, query, existência de usuário em login).

### B. Prisma / Postgres
- Nunca usar `$queryRaw`/`$executeRaw` com interpolação de string — sempre usar tagged template ou parâmetros.
- `select`/`include` explícitos para não devolver campos sensíveis (senha hash, tokens) em respostas de API.
- Dados sensíveis (senha, PII, dados financeiros) nunca armazenados em texto puro — senha sempre hash (bcrypt/argon2), nunca criptografia reversível.
- Usuário do banco usado pela aplicação com permissões mínimas necessárias (não superuser).

### C. Redis
- Nenhuma chave contendo dado sensível sem TTL definido.
- Sessão invalidada no Redis ao fazer logout ou trocar senha (não só apagar cookie no client).
- Dados sensíveis em fila (BullMQ) não trafegam em texto puro se o Redis não for isolado/criptografado na rede.

### D. Next.js / Front-end
- Variáveis de ambiente sem prefixo `NEXT_PUBLIC_` nunca acessadas no client.
- Conteúdo vindo de usuário/API renderizado sem `dangerouslySetInnerHTML` sem sanitização (XSS).
- Chamadas a rotas de API sensíveis protegidas por CSRF quando usam cookie de sessão (não aplicável se for só Bearer token).
- Nenhum secret (API key, service token) embutido no bundle client-side.
- Nenhuma credencial de banco (Postgres/Redis) ou client Prisma presente no código do Next.js — o front é cliente da API NestJS, nunca acessa o banco diretamente. Ver skill `nextjs-best-practices`.
- Token de autenticação repassado às chamadas para a API NestJS de forma segura (cookie httpOnly ou header, nunca exposto em query string ou log).

### E. Flutter / Mobile
- Nenhum secret (client secret, chave de API) embutido no app — apps mobile são facilmente decompilados; segredo só existe no backend.
- Token de sessão armazenado em local seguro do dispositivo (`flutter_secure_storage`), nunca em `SharedPreferences` puro para dados sensíveis.
- Certificate pinning considerado para chamadas à API em apps que lidam com dado sensível (defesa extra contra MITM em rede pública/corporativa).

### F. Geral / infraestrutura
- Sem secrets hardcoded no código (grep por padrões tipo `sk_`, `AKIA`, senha em string literal).
- Dependências: se o usuário pedir, rodar `npm audit` / equivalente e reportar CVEs de severidade alta/crítica.
- Headers de segurança configurados (CSP, `helmet` no Nest) e **CORS configurado explicitamente** — não deixar implícito/ausente mesmo quando front e back estão na mesma origem hoje; se algum client externo passar a chamar a API direto do navegador de outra origem no futuro, a ausência de CORS explícito vira lacuna silenciosa. Restringir à(s) origem(ns) real(is), nunca `*` em endpoint autenticado.
- Cookie de sessão com `secure: true` condicionado a `NODE_ENV=production` é aceitável — mas confirmar que o **deploy real sempre define essa env var** corretamente; se não definir (ou definir errado), a sessão trafega sem `secure` silenciosamente, sem erro visível. Checklist de deploy deve confirmar isso, não assumir.
- Logs não contêm senha, token, número de cartão ou outro dado sensível em texto puro.

## Ferramentas de Auditoria

Complementam a revisão de código (que é estática, feita por leitura) com varredura automatizada. Sugerir ao usuário quando fizer sentido (ex: antes de um release, ou se o projeto ainda não tem isso no CI):

- **[Gitleaks](https://github.com/gitleaks/gitleaks)** — varre o **histórico completo do Git** por segredos vazados (não só o estado atual do código — um secret commitado e depois removido continua no histórico). Rodar localmente (`gitleaks detect`) e, idealmente, como job de CI em todo PR e como pre-commit hook.
- **[OWASP ZAP](https://www.zaproxy.org/)** — varredura dinâmica (DAST): ataca a aplicação já rodando (staging), útil para achar problemas que só aparecem em runtime (headers de segurança ausentes, endpoints não documentados expostos, etc). Não roda contra código estático — precisa de uma instância da aplicação no ar.
- **[OpenGrep](https://github.com/opengrep/opengrep)** — varredura estática (SAST) com regras customizáveis, para achar padrões de código inseguro em escala (ex: uso de `$queryRaw` com interpolação, `dangerouslySetInnerHTML` sem sanitização) de forma automatizada, complementando esta revisão manual.

Nenhuma dessas ferramentas substitui esta skill — elas automatizam parte da varredura; a revisão de lógica de negócio, ownership e autorização (IDOR, regra de negócio no front) continua exigindo leitura humana/IA do código.

### Formato da resposta
Resumo no topo (quantos achados por severidade, e confirmação de que as 5 vulnerabilidades críticas foram checadas nomeadamente), depois a lista detalhada. Se nada crítico for encontrado, diga isso explicitamente em vez de forçar achados de baixa relevância.
