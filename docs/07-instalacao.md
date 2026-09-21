# Instalação — do zero

Guia técnico para clonar o repositório e rodar o sistema completo pela
primeira vez. Diferente dos outros documentos desta pasta, este é escrito
para quem vai efetivamente rodar o código (desenvolvedor), não para
stakeholders de negócio.

## Pré-requisito crítico: o IdP central

O login (SSO) deste sistema depende de um **servidor de IdP central da
empresa que não está neste repositório** — a pasta `idp-client/` aqui
dentro é só a biblioteca cliente (middleware Express) que o backend usa
para falar com esse IdP, não o IdP em si.

Sem esse IdP rodando e acessível, **o backend sobe normalmente, mas o login
não funciona** (`/auth/login` e `/auth/callback` falham). Antes de
prosseguir, você precisa:

1. Ter acesso a uma instância do IdP central rodando (localmente ou em
   algum ambiente acessível).
2. Cadastrar um "sistema" cliente para o App Copperline nesse IdP, obtendo
   `client_id` e `client_secret`.
3. Cadastrar em `systems.redirect_uris`, no IdP, a URL exata que será usada
   como `IDP_REDIRECT_URI` (comparação exata — sem barra a mais, sem trocar
   `localhost` por IP, etc.).

Se você não tem acesso a esse IdP, consiga a URL/instância com quem mantém
a infraestrutura antes de continuar.

## Pré-requisitos de máquina

- **Docker** e **Docker Compose** (caminho recomendado — sobe Postgres,
  Redis, backend e frontend de uma vez).
- **Node.js 24** — só necessário se for rodar backend/frontend fora do
  Docker, em modo dev com hot-reload.
- **Flutter SDK** (Dart ≥ 3.12) — só necessário para rodar o app mobile.
- **Git**.

## Passo a passo — via Docker Compose (recomendado)

1. Clone o repositório.
2. Copie o `.env.example` da raiz para `.env` e preencha:
   - `SESSION_SECRET` — qualquer string aleatória longa (uso local).
   - `IDP_CLIENT_ID` / `IDP_CLIENT_SECRET` — obtidos no cadastro do IdP
     (ver seção acima).
   - `ADMIN_API_KEY` — qualquer string, usada entre frontend e backend
     para rotas administrativas.
   - Bloco `WK_RADAR_*` e `WK_BI_*` — credenciais do ERP/BI. **Sem essas
     credenciais o sistema sobe, mas a sincronização de dados do ERP
     falha** — peça as credenciais de homologação/desenvolvimento com quem
     administra o WK Radar/WK BI.
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — opcional; sem ele o sistema sobe
     normalmente e só o envio de notificações push fica indisponível.
3. Abra o `docker-compose.yml` na raiz e ajuste manualmente os valores que
   **não** vêm do `.env` raiz e estão fixos no arquivo, porque dependem da
   rede/IP da sua máquina:
   - `IDP_URL`, `IDP_AUTHORIZE_URL`, `IDP_REDIRECT_URI` (serviço
     `backend`) — apontam para o endereço do IdP e para o endereço em que
     o backend será acessado pelo navegador/celular.
   - `FRONTEND_PUBLIC_URL` (serviço `backend`) e `API_PUBLIC_URL` (serviço
     `frontend`) — endereço público do frontend.

   Regra geral: se você só vai testar no navegador da própria máquina,
   `http://localhost:<porta>` funciona para a maioria dessas variáveis
   (exceto quando o IdP estiver em outro processo/máquina). Se for testar
   pelo app mobile num celular físico na mesma rede, use o IP local da
   máquina (ex: `192.168.x.x`) em vez de `localhost`, e cadastre esse
   mesmo IP em `systems.redirect_uris` no IdP.
4. Suba os serviços:
   ```
   docker compose up -d
   ```
   As migrations do Prisma são aplicadas automaticamente na subida do
   container do backend (`prisma migrate deploy`) — não é preciso rodar
   nada manualmente.
5. Acesse:
   - Frontend (portal web): `http://localhost:3020`
   - Backend (API): `http://localhost:3010`
   - Postgres: exposto em `localhost:5434` (propositalmente, para permitir
     rodar `npx prisma migrate dev` direto da máquina host quando
     necessário)
   - Redis: não exposto ao host, só acessível entre os containers

## Passo a passo — backend em modo dev (fora do Docker)

Use este caminho se quiser hot-reload no backend.

1. Suba só Postgres e Redis via Docker (`docker compose up -d postgres
   redis`), ou aponte para instâncias já existentes.
2. `cd backend && npm install`.
3. Copie `backend/.env.example` para `backend/.env` e preencha (mesmas
   variáveis do `.env` raiz, adaptadas — ex: `DATABASE_URL` apontando para
   `localhost:5434` em vez do hostname interno do compose).
4. Aplique as migrations: `npx prisma migrate dev`.
5. Rode: `npm run start:dev`.

## Passo a passo — frontend em modo dev (fora do Docker)

1. `cd frontend && npm install`.
2. Copie `frontend/.env.example` para `frontend/.env.local` e preencha
   `API_URL`, `API_PUBLIC_URL` e `ADMIN_API_KEY` (mesma chave do backend).
3. Rode: `npm run dev`.

## App mobile (Flutter)

O endereço do backend **não é fixado em arquivo** — é configurado em
runtime, na primeira execução do app, pela tela de configuração de
servidor (`ConfigurarServidorScreen`), que salva o valor localmente no
aparelho.

1. `cd mobile && flutter pub get`.
2. Rode normalmente (`flutter run`). Se quiser já abrir com um servidor
   pré-preenchido (opcional), use
   `flutter run --dart-define=API_BASE_URL=http://<ip>:3010`.
3. Se for testar num celular físico na mesma rede da máquina que roda o
   backend, veja `mobile/README.md` — cobre detalhes específicos desse
   cenário (regra de firewall do Windows liberando as portas do backend e
   do IdP para a rede, e o cuidado de usar o IP da rede local em vez de
   `localhost`/`127.0.0.1`, que no celular apontariam para o próprio
   celular).

## Resumo de portas (Docker Compose)

| Serviço | Porta no host |
|---|---|
| Frontend | 3020 |
| Backend | 3010 |
| Postgres | 5434 |
| Redis | não exposta ao host |

## Problemas comuns

- **Login sempre "expira" / nunca completa** — normalmente é
  descompasso entre a origem usada pelo navegador e `IDP_REDIRECT_URI`
  cadastrado no IdP (o cookie de sessão é por origem exata), ou o IdP não
  está acessível no endereço configurado.
- **Sincronização com o ERP não traz dados** — confira se as credenciais
  `WK_RADAR_*`/`WK_BI_*` estão preenchidas e válidas; acompanhe os logs na
  tela administrativa de Sincronização (ver
  [Telas](03-telas-web-mobile.md)).
- **App mobile não conecta** — confirme que o endereço configurado na tela
  de servidor do app é alcançável a partir do celular (não use
  `localhost`, que no celular aponta para ele mesmo).
