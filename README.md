# App Copperline

Sistema de apoio à equipe comercial: centraliza clientes, produtos, preços,
estoque, pedidos e notas fiscais sincronizados do ERP, e adiciona rotinas
comerciais do dia a dia (aprovação de desconto, metas, roteiro de visitas,
rastreio de equipe, cadastro de clientes) via portal web (Next.js) e app mobile
(Flutter), com backend em NestJS.

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | NestJS (TypeScript), Prisma, PostgreSQL, Redis, BullMQ |
| Web | Next.js (App Router, Server Components), Tailwind CSS |
| Mobile | Flutter (Riverpod), fila offline, atualização própria do APK |
| Autenticação | SSO centralizado pelo IdP interno (`@copperline/idp-client`) |
| ERP | WK Radar (API REST + serviços `.svc` de BI/estoque/financeiro) |

## Subindo o ambiente

```bash
cp .env.example .env          # preencha os segredos e o HOST_PUBLICO
docker compose up -d --build  # postgres, redis, backend (3010) e frontend (3020)
```

Variáveis do `docker-compose.yml` que mais mudam entre máquinas:

- `HOST_PUBLICO`: IP/host pelo qual celulares e navegadores enxergam a máquina
  (URLs do IdP, callback de login e CORS). Muda com o DHCP.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: padrão `postgres` /
  `postgres` / `copperline`.
- Segredos (`SESSION_SECRET`, `SEGREDO_CRYPTO_KEY`, `IDP_CLIENT_SECRET`,
  `ADMIN_API_KEY`) vêm sempre do `.env`, nunca do código.

Migrations: `npx prisma migrate deploy` (não use `migrate dev` neste projeto: ele
derruba o índice de pedidos). Guia completo em [Instalação](docs/07-instalacao.md).

## Funcionalidades

- **Comercial:** clientes (cadastro e edição com consulta de CNPJ/CEP e mapa),
  produtos, tabelas de preço, pedidos e orçamentos (desconto por item, aprovação
  por alçada, PDF do pedido), notas fiscais, estoque por lote.
- **Equipe:** metas e ranking, oportunidades, coberturas temporárias, agenda e
  visitas com check-in por foto e raio, rastreio de localização, relatório diário.
- **IA:** resumo de cliente/visita, insights de oportunidade e sazonalidade, com
  lista de chaves de LLM e fallback em cadeia.
- **Notificações:** push (FCM) e caixa de entrada, mensagens do admin para
  vendedores, mensagens periódicas.
- **App mobile:** funciona offline (snapshot + fila de ações com confirmação),
  cadastro de cliente em campo, atualização do próprio app sem Play Store.

## O que se configura pelo painel (sem mexer em env)

Admin → Configurações (⚙), em três grupos:

| Grupo | Aba | O que controla |
|---|---|---|
| Comercial | Orçamento, Alçada de aprovação, Documento do Pedido | regras de orçamento/desconto e cabeçalho do PDF |
| Operação | Funcionalidades | liga/desliga **envio de pedidos**, **cadastro de clientes** e **envio de clientes ao ERP** |
| Operação | Rastreio | regras de rastreio e check-in |
| Integrações | ERP (WK Radar) | credenciais, URLs, IDs de filial/unidade de venda, início da carga inicial, janelas de busca e horários do relatório diário |
| Integrações | Provedores de API | endpoints de CNPJ, CEP e mapa, vários por tipo, com ordem de fallback, token e limite |
| Integrações | LLM | provedor, modelo e chaves com fallback |

Regras importantes:

- **Valor salvo no painel vence a env.** Campo vazio volta a valer a env. Segredos
  ficam cifrados no Postgres (AES-256-GCM, chave em `SEGREDO_CRYPTO_KEY`) e nunca
  são devolvidos pela API.
- **Envio de pedidos desligado:** o vendedor continua salvando orçamentos; pedidos
  na fila do celular ficam retidos e saem quando for religado.
- **Provedores de API:** a ordem da lista é a ordem de tentativa. "Não
  encontrado" é definitivo; falha ou limite estourado passa para o próximo. Cada
  endpoint precisa falar um formato conhecido (Mileena/ViaCEP, ReceitaWS/BrasilAPI,
  Nominatim).
- A **frequência** de cada sincronização fica em Admin → Sincronização.

## Acessos e segurança

- Admin → Sistema → **Acessos** lista as contas e os celulares/navegadores
  conectados; permite **bloquear a conta** (derruba as sessões e impede novo
  acesso a este sistema, sem afetar o IdP) e **encerrar uma sessão**.
- Papéis e escopo de dados são sempre validados no backend a partir do JWT.
- Sessões ficam no Redis (prefixo `session:`); contas bloqueadas em
  `acesso:bloqueados`.

## Código: onde fica cada coisa

```
backend/src/
  sync/                 scheduler → processor → service + uma strategy por entidade
  erp-client/           autenticação e HTTP do WK Radar (token, throttling)
  wk-bi-client/ estoque-svc-client/ empresarial-svc-client/ financeiro-svc-client/
  credenciais-erp/      credenciais e parâmetros editáveis pelo painel (override da env)
  provedores-api/       cadeia de provedores de CNPJ, CEP e mapa (fallback)
  consulta-cnpj/ consulta-cep/ geocodificacao/ municipio-wk/
  clientes/             cadastro/edição e envio ao ERP por fila (BullMQ)
  pedidos/              criação, aprovação de desconto, PDF, envio ao ERP
  configuracoes/        abas de configuração (admin) e chaves de funcionalidade
  acessos/              contas, sessões e bloqueio
  mobile/               snapshot offline e fila de ações (idempotente)
  app-versao/           APK servido pelo backend (atualização obrigatória)
frontend/src/app/       páginas (painel, clientes, pedidos, configuracoes, admin/*)
mobile/lib/             core (api, providers, local_db, atualizacao) e screens
```

Padrões do projeto: DDD só onde há regra de negócio real (entidades de domínio com
teste isolado); sincronização com ERP sempre via módulo cliente dedicado; chaves de
Redis com prefixo por domínio (`session:*`, `cache:*`, `rate:*`, `lock:*`);
commits em Conventional Commits.

## App mobile: publicar uma versão

```bash
cd mobile
node tools/publicar-apk.mjs --bump --notas "O que mudou nesta versão"
```

O script gera o APK assinado, calcula o hash e publica em `app-releases/android/`;
o app confere a versão ao abrir, ao voltar ao primeiro plano e a cada 5 minutos, e
exige a atualização quando há versão mais nova. Guarde fora da máquina o
`mobile/android/copperline-release.jks` e o `key.properties` (sem eles não é
possível publicar atualizações do mesmo app).

## Documentação

A documentação funcional do sistema está em [`docs/`](docs/README.md):

1. [Visão geral](docs/01-visao-geral.md)
2. [Módulos funcionais](docs/02-modulos-funcionais.md)
3. [Telas — portal web e app mobile](docs/03-telas-web-mobile.md)
4. [Integração com o ERP e o BI de estoque](docs/04-integracao-erp.md)
5. [Autenticação e controle de acesso](docs/05-autenticacao-e-acesso.md)
6. [Infraestrutura](docs/06-infraestrutura.md)
7. [Instalação — do zero](docs/07-instalacao.md)

Ver também [casos de uso de IA](docs/casos-de-uso-ia.md).
