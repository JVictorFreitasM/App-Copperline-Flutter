---
name: idp-client
description: |
  Documenta a implementação e o uso da biblioteca interna @copperline/idp-client — middleware Express que centraliza o login (SSO) de todos os sistemas da empresa contra o IdP central. Cobre o fluxo OAuth2/OIDC (login/callback/logout), verificação de token via JWKS, modelo de sessão, integração em backends NestJS (via MiddlewareConsumer, já que NestJS roda sobre Express) e em sistemas Express/EJS legados.
  Use quando: implementar login/autenticação em qualquer sistema do parque, proteger rotas com requireAuth/requireRole, integrar um backend NestJS ou Express/EJS ao IdP central, debugar problemas de sessão/token/SSO, ou revisar código que mexe em autenticação.
---

# @copperline/idp-client

Middleware de integração com o IdP centralizado da empresa. Qualquer sistema do parque (NestJS, Express puro, EJS server-rendered) usa esse pacote em vez de reimplementar o fluxo OAuth2/JWT — login, callback, verificação de token e logout são sempre os mesmos, únicos, e mantidos num só lugar.

## Onde a lib se encaixa na arquitetura do projeto

Todos os backends NestJS do projeto autenticam usuários através dela. Ela resolve exatamente o mesmo problema que o restante da stack já resolve por convenção — **o front nunca fala direto com um sistema externo, sempre passa pelo próprio backend** (mesma lógica documentada na skill `nextjs-best-practices` para a API NestJS): aqui, o "sistema externo" é o IdP, e quem fala com ele é sempre o backend de cada sistema cliente, nunca o navegador.

## Modelo do Fluxo (o que a lib faz por dentro)

1. **`GET /auth/login`**: gera um `state` aleatório (proteção CSRF), grava na sessão do backend, redireciona o navegador pro `/authorize` do IdP.
2. **`GET /auth/callback`**: recebe o `code` de volta, valida o `state` contra o que está na sessão, troca o `code` por `access_token`/`refresh_token` (chamada server-to-server pro `/token` do IdP), regenera o id de sessão (mitiga session fixation) e grava os tokens **só na sessão do backend** — nunca no navegador.
3. **`requireAuth`** (middleware de proteção de rota):
   - Sem token na sessão → redireciona pro login.
   - Token dentro da validade → valida localmente via JWKS (assinatura RS256 + `aud` = `clientId` + `exp`), sem chamar o IdP a cada requisição.
   - Token expirado (ou falha na validação local, ex: chave rotacionada) → tenta renovar via `refresh_token`; se a renovação também falhar, apaga a sessão e manda pro login de novo.
4. **`requireRole(role)`**: roda depois de `requireAuth`, checa `req.user.role` contra os papéis permitidos.
5. **`GET /auth/logout`**: revoga o `refresh_token` no IdP (best-effort — não bloqueia o logout local se o IdP estiver fora), destrói a sessão local, e só então redireciona pro `/session/end` do IdP (RP-Initiated Logout) — esse último passo é o que também encerra a sessão do IdP em si; sem ele, o SSO reautenticaria silenciosamente no próximo login.

## Modelo de Sessão (não negociável)

`access_token`/`refresh_token` **nunca chegam ao navegador** — ficam só em `req.session.idpAuth`, do lado do backend. Isso vale tanto pra sistemas server-rendered (EJS) quanto pra APIs por trás de uma SPA/Next.js: o front nunca fala com o IdP, só com o próprio backend do sistema, que é quem mantém a sessão.

Depois de `requireAuth`, `req.user` expõe as claims já validadas — nunca o JWT cru:

```ts
interface IdpUser {
  sub: string;
  email: string;
  name: string;
  role: string | null;
  system: string;
}
```

## Configuração (`IdpClientConfig`)

| Campo | Obrigatório | Default | Descrição |
|---|---|---|---|
| `idpUrl` | sim | — | URL base do IdP, usada em chamadas server-to-server (`/token`, JWKS, `/revoke`). |
| `authorizeUrl` | não | `idpUrl` | URL do IdP como o **navegador** do usuário a enxerga — só definir quando difere de `idpUrl` (ex: backend containerizado falando com o IdP via nome de serviço interno, mas o navegador do usuário precisa de `localhost`/domínio público). Usada só no redirect de `/auth/login`. |
| `homeUrl` | não | `${authorizeUrl}/home` | Destino do botão "Voltar aos sistemas" nas telas de erro de login. |
| `clientId` / `clientSecret` | sim | — | Credenciais do sistema, cadastradas no painel de administração do IdP. **`clientSecret` nunca pode chegar ao front** — só existe no backend. |
| `redirectUri` | sim | — | Deve bater exatamente com um dos `redirectUris` cadastrados pra esse sistema no IdP. |
| `loginPath` / `callbackPath` / `logoutPath` | não | `/auth/login`, `/auth/callback`, `/auth/logout` | Paths montados no router. |
| `postLoginRedirect` / `postLogoutRedirect` | não | `/` | Fallback quando não há `returnTo` salvo. |
| `jwksCacheTtlMs` | não | `3600000` (1h) | Cache do JWKS — busca de novo automaticamente se aparecer um `kid` desconhecido (rotação de chave no IdP). |
| `issuer` | não | — | Se definido, valida `iss` do token além de `aud`. |

A lib **não traz sessão própria** — cada sistema cliente configura a sua (`express-session` ou equivalente).

## Integração em backend NestJS (padrão do projeto)

NestJS roda sobre Express por padrão, então a lib se integra de duas formas complementares: **montagem do router** (feita uma vez, no bootstrap) e **proteção de rotas** (feita via `MiddlewareConsumer`, idiomático ao Nest, em vez de `app.use()` solto).

### 1. Bootstrap (`main.ts`)

```ts
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import session from 'express-session';
import { createIdpAuth } from '@copperline/idp-client';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production' },
    }),
  );

  const idpAuth = createIdpAuth({
    idpUrl: process.env.IDP_URL!,
    clientId: process.env.IDP_CLIENT_ID!,
    clientSecret: process.env.IDP_CLIENT_SECRET!,
    redirectUri: process.env.IDP_REDIRECT_URI!,
  });

  app.use(idpAuth.router); // monta GET /auth/login, /auth/callback, /auth/logout

  // Disponibiliza requireAuth/requireRole pros módulos que vão usá-los
  // via MiddlewareConsumer (ver AuthModule abaixo).
  app.set('idpAuth', idpAuth);

  await app.listen(3000);
}
bootstrap();
```

### 2. Proteção de rotas por módulo (`MiddlewareConsumer`)

Prefira `MiddlewareConsumer.apply()` a espalhar `app.use()` solto — assim cada módulo declara explicitamente quais das suas rotas exigem autenticação/role, no mesmo lugar onde o módulo já declara seus controllers.

```ts
// pedidos.module.ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { requireRole } from '@copperline/idp-client';
import { PedidosController } from './pedidos.controller';

@Module({ controllers: [PedidosController] })
export class PedidosModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    const idpAuth = /* injetar a instância criada no bootstrap — ver nota abaixo */;

    consumer.apply(idpAuth.requireAuth).forRoutes(PedidosController);

    consumer
      .apply(idpAuth.requireAuth, requireRole('admin'))
      .forRoutes({ path: 'pedidos/admin/*', method: RequestMethod.ALL });
  }
}
```

Como `createIdpAuth()` só deve ser chamado uma vez (ele cria seu próprio `JwksCache`), disponibilize a instância criada no bootstrap para os módulos via um provider injetável (ex: um `IdpAuthModule` global com um `IDP_AUTH` provider), em vez de chamar `createIdpAuth()` de novo em cada módulo.

### 3. Acessando `req.user` em um controller — decorator customizado

A lib já estende globalmente o tipo `Request` do Express com `user?: IdpUser` (`types/express.ts`), então `req.user` já é tipado sem trabalho extra. Seguindo a convenção do projeto de priorizar decorators customizados (ver skill `nestjs`, seção "Priorize Decorators Customizados"), exponha isso como um `@CurrentUser()`:

```ts
// common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): IdpUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// uso no controller:
@Get('painel')
painel(@CurrentUser() user: IdpUser) {
  return `Olá, ${user.name} (${user.role})`;
}
```

## Integração em sistema Express/EJS legado

Para sistemas que não usam NestJS (ex: sistemas legados server-rendered), o uso é direto, sem a camada de `MiddlewareConsumer`:

```ts
import express from 'express';
import session from 'express-session';
import { createIdpAuth, requireRole } from '@copperline/idp-client';

const idpAuth = createIdpAuth({
  idpUrl: process.env.IDP_URL!,
  clientId: process.env.IDP_CLIENT_ID!,
  clientSecret: process.env.IDP_CLIENT_SECRET!,
  redirectUri: process.env.IDP_REDIRECT_URI!,
});

const app = express();
app.use(session({ secret: process.env.SESSION_SECRET!, resave: false, saveUninitialized: false }));
app.use(idpAuth.router);

app.get('/painel', idpAuth.requireAuth, (req, res) => {
  res.send(`Olá, ${req.user!.name} (${req.user!.role})`);
});

app.get('/admin', idpAuth.requireAuth, requireRole('admin'), (req, res) => {
  res.send('Só admin entra aqui.');
});

app.listen(3001);
```

## Distribuição

Pacote não publicado em registry privado ainda. Consumir como dependência de path/git até a definição do registry:

```json
{
  "dependencies": {
    "@copperline/idp-client": "file:../idp-client"
  }
}
```

Rodar `npm run build` no pacote antes (consumido a partir de `dist/`, não de `src/`).

## Limitação Herdada do Modelo JWT (importante saber, não é bug)

Revogar o acesso de um usuário no painel de administração do IdP **não invalida instantaneamente** um `access_token` já emitido — só impede a emissão de novos (e, por consequência, a próxima renovação via refresh token, já que `requireAuth` reconfere o acesso ativo a cada rotação). Um token já em mãos continua válido até expirar naturalmente (padrão: 15 min). Isso é esperado do modelo JWT/JWKS (verificação local, sem round-trip ao IdP a cada requisição) — não tente "corrigir" isso reduzindo o TTL do JWKS cache, que é uma coisa diferente (cache de chave pública, não do token em si).

**Decorrência prática**: como o `access_token` continua válido por até 15 min mesmo após revogação, é importante confirmar que os sistemas clientes **realmente respeitam o `exp`** a cada requisição (o `requireAuth` da lib já faz isso corretamente) e não cacheiam o resultado de uma verificação anterior além do necessário — um cache indevido no lado cliente estenderia essa janela além dos 15 min pretendidos.

## Limitações Conhecidas do Servidor IdP (lado servidor, fora do `idp-client`)

Estas são observações sobre o **próprio servidor do IdP** (não a lib cliente) — relevantes para quem mantém o IdP e para quem revisa segurança do parque como um todo, já que todo sistema cliente depende dessas garantias existirem do lado servidor.

- **Rate limiting só em memória**: reinicia com o processo e não escala horizontalmente — múltiplas instâncias do IdP, cada uma com seu próprio contador, efetivamente multiplicam o limite real (ex: limite de 5 tentativas/min com 3 instâncias atrás de um load balancer vira ~15/min na prática). Documentado como limitação conhecida. Se o IdP algum dia rodar mais de uma instância, migrar o contador para Redis (compartilhado entre instâncias) é necessário antes disso — não é opcional a partir desse ponto.
- **Parâmetro `state` no `/authorize`**: o `idp-client` (lado cliente) já gera e valida `state` corretamente (`login.ts`/`callback.ts` — CSRF no fluxo de redirecionamento). O que não está confirmado é se o **servidor** do IdP trata/repassa esse `state` de volta no `/authorize` → `AuthorizeInputDTO`/`AuthorizeDecision`. Para o mecanismo funcionar ponta a ponta, o servidor precisa, no mínimo, ecoar o `state` recebido de volta na URL de redirect ao `redirectUri` — sem isso, a validação do lado cliente não tem o que comparar. Verificar se isso já existe no servidor ou se foi uma omissão.
- **PKCE não implementado**: aceitável pelo RFC 6749/7636 para clients confidenciais server-side (com `client_secret`, que é o caso de todos os sistemas atuais do parque). Se algum sistema cliente futuro for um **public client** (SPA que fala direto com o IdP sem backend, ou app mobile nativo sem backend intermediário — o que hoje **não é o caso**, já que o modelo do `idp-client` sempre passa pelo backend do sistema cliente), PKCE se torna obrigatório antes de habilitar esse client. Enquanto todo client continuar sendo confidencial (backend com `client_secret`, que é a arquitetura padrão documentada nesta skill), não é uma lacuna ativa.
- **Cookie de sessão sem `secure` fora de produção**: comportamento intencional, condicionado a `NODE_ENV=production` (ver exemplo de bootstrap acima — `cookie: { secure: process.env.NODE_ENV === 'production' }`). Correto em princípio, mas depende de o **deploy real sempre definir essa env var** corretamente; se `NODE_ENV` não for setado (ou for setado errado) em produção, a sessão trafega sem `secure` silenciosamente, sem erro visível. Checklist de deploy deve confirmar isso explicitamente, não assumir.
- **CORS não configurado explicitamente**: sem problema enquanto login-ui/admin-frontend do IdP forem servidos pelo mesmo backend (mesma origem). Se algum client externo passar a fazer chamadas diretas via navegador para o IdP a partir de outra origem (fora do fluxo padrão do `idp-client`, que é sempre server-to-server), vai faltar configuração explícita de CORS — hoje não é necessário porque nenhum fluxo do `idp-client` depende disso (tudo é redirect de página inteira ou chamada server-to-server), mas vale revisitar se esse padrão mudar.

Nenhum desses pontos exige mudança imediata na forma como os sistemas clientes usam o `idp-client` — são itens para quem mantém o servidor do IdP acompanhar, e para revisões de segurança do parque saberem que existem como limitações aceitas/pendentes de confirmação.

## Segurança — já coberto pela lib (não reimplementar)

- CSRF no fluxo de redirect: `state` gerado em `/auth/login`, validado em `/auth/callback`.
- Session fixation: `req.session.regenerate()` no login bem-sucedido.
- `clientSecret` nunca sai do backend — nunca em variável `NEXT_PUBLIC_*`, nunca em código client-side.
- Tokens nunca chegam ao navegador — só cookie de sessão `httpOnly`.
- Logout também revoga no IdP (best-effort) e encerra a sessão do IdP via RP-Initiated Logout — sem isso, o SSO reautenticaria silenciosamente.
- Verificação de token: assinatura RS256 via JWKS, `aud` obrigatoriamente igual ao `clientId` do próprio sistema (impede que um token válido para o Sistema A seja aceito pelo Sistema B), `exp` respeitado com folga de 5s contra diferença de relógio.

Ao revisar (`pr-review`/`security-review`) código que mexe em autenticação: **não deve haver reimplementação manual** de verificação de JWT, geração de `state`, ou lógica de refresh — se algo desses aparece fora do `idp-client`, é sinal de que a lib não está sendo usada corretamente.
