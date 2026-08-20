# Padrão de autorização por módulo

Este módulo (`AuthorizationExampleModule`, montado em `/exemplos/autorizacao`) é
só uma referência — não é um módulo de negócio. Cada módulo futuro (sync com
ERP, OS 04+) copia um destes três padrões em vez de reinventar.

## 1. `requireAuth` sozinho

Qualquer usuário autenticado no SSO acessa, independente de `role`. Usar para
operações de leitura que não têm risco além de exigir estar logado.

```ts
consumer
  .apply(this.idpAuth.requireAuth)
  .forRoutes({ path: 'exemplos/autorizacao/perfil', method: RequestMethod.GET });
```

## 2. `requireAuth` + `requireRole` encadeados

Autenticado **e** com o `role` exigido. Usar para operações que alteram
estado ou expõem dado sensível. `requireRole` sempre vem depois de
`requireAuth` na cadeia (depende de `req.user` já preenchido) e nunca é usado
sozinho.

```ts
consumer
  .apply(this.idpAuth.requireAuth, requireRole('admin'))
  .forRoutes({ path: 'exemplos/autorizacao/admin', method: RequestMethod.POST });
```

## 3. `ApiKeyGuard` (`src/common/guards/api-key.guard.ts`)

Para endpoints administrativos internos que **não** são chamados por um
usuário logado via navegador, e sim por automação/serviço (ex: disparo manual
de sincronização com o ERP a partir de um script ou de outro sistema
interno). Não passa pelo `idpAuth.requireAuth` — é `@UseGuards(ApiKeyGuard)`
direto no controller, comparando o header `x-api-key` contra `ADMIN_API_KEY`
em tempo constante.

```ts
@Post('sync-manual')
@UseGuards(ApiKeyGuard)
syncManual() { ... }
```

Nunca combine os três num mesmo endpoint — escolha o que corresponde a quem
de fato vai chamar a rota (usuário via navegador → `requireAuth`
[+ `requireRole`]; automação/serviço → `ApiKeyGuard`).

## Qual guard cobre qual operação (referência para os módulos de sync, OS 04+)

| Operação                                            | Proteção                          |
|------------------------------------------------------|------------------------------------|
| Consultar status/histórico de uma sincronização       | `requireAuth`                      |
| Ativar/desativar uma entidade sincronizada             | `requireAuth` + `requireRole('admin')` |
| Disparar sincronização manual via automação/serviço    | `ApiKeyGuard`                      |

A regra geral: leitura por um usuário logado exige só sessão válida;
qualquer mudança de configuração de sync exige `role admin`; qualquer chamada
que não venha de uma sessão de navegador (scripts, outros sistemas) usa API
key, nunca tenta se passar por um usuário autenticado.
