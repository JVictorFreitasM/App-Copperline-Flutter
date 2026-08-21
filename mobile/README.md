# Copperline Mobile

App mobile do App Copperline (Flutter + Riverpod).

- **OS-MOBILE-11**: bootstrap — `ProviderScope`, cliente HTTP central
  (`ApiClient`), tela inicial que confirma comunicação com o backend via
  `GET /health`.
- **OS-MOBILE-12**: autenticação — login via SSO (WebView embutida
  apontando pro fluxo já existente do `idp-client` no backend), sessão
  guardada em local seguro do dispositivo, logout.
- **OS-MOBILE-13 a 16**: telas de negócio (equivalente mobile de
  OS-WEB-11 a 15) — estoque (consulta pontual, priorizada primeiro por ser
  o caso de uso de campo/depósito), clientes, produtos (com atalho "Ver
  estoque") e pedidos, todas com listagem paginada + filtro + tela de
  detalhe onde aplicável. A tela inicial (`HomeScreen`) virou o menu de
  navegação entre essas seções.

## Testando num celular físico (não emulador)

`10.0.2.2` (alias do host visto de dentro do emulador Android) não
funciona num aparelho físico - use o IP da máquina na rede Wi-Fi:

```bash
flutter build apk --debug --dart-define=API_BASE_URL=http://<IP-da-rede>:3010
flutter install # com o celular conectado via USB e depuração USB ativada
```

Dois pré-requisitos que não são óbvios e já causaram falha silenciosa de
login numa configuração anterior (com `localhost`, ver histórico da
OS-MOBILE-12):

1. **Firewall do Windows**: se o perfil da rede Wi-Fi estiver como
   "Público" (padrão), o Windows bloqueia conexão de entrada por padrão -
   precisa de uma regra liberando as portas TCP do backend (3010) e do IdP
   (3000) especificamente, não um "desligar o firewall" geral.
2. **`redirect_uri` do IdP**: o login (WebView) depende do IdP redirecionar
   de volta pro app depois da autenticação - esse endereço é validado por
   comparação **exata** contra a lista cadastrada pro sistema no IdP
   (`systems.redirect_uris`). `IDP_AUTHORIZE_URL`/`IDP_REDIRECT_URI` no
   `docker-compose.yml` da raiz do projeto precisam usar o mesmo IP (nunca
   `localhost`, que dentro da WebView do celular aponta pro próprio
   celular) - e esse IP precisa estar cadastrado no IdP também.

## Rodando localmente

A URL base da API **não tem valor padrão hardcoded** — precisa ser passada
via `--dart-define` a cada execução/build:

```bash
# Emulador Android (10.0.2.2 é o alias do host visto de dentro do emulador)
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3010

# Dispositivo físico na mesma rede (IP da máquina que roda o backend)
flutter run --dart-define=API_BASE_URL=http://192.168.x.x:3010
```

Sem essa variável, o app sobe mas lança um erro claro ao tentar chamar a
API (`ApiClient.baseUrl`), em vez de silenciosamente apontar pra um host
que pode não existir no ambiente de quem estiver rodando.

> **Alvo Android/iOS, não web**: a autenticação usa `flutter_inappwebview`
> (WebView nativa + acesso ao cookie jar) — não roda em `flutter run -d
> chrome`. Testar em emulador Android, dispositivo físico, ou iOS.

## Como o login funciona

O `idp-client` (lib compartilhada de SSO do backend, ver skill
`idp-client`) foi desenhado pra clients confidenciais com backend — o
token nunca chega no navegador/app, só um cookie de sessão `httpOnly`. Pra
não reimplementar esse fluxo (nem criar um mecanismo de auth paralelo), o
app mobile reaproveita exatamente o mesmo caminho do web, só que embutido
numa WebView:

1. `LoginScreen` abre `GET /auth/login?returnTo=<API_BASE_URL>/auth/me`
   numa `InAppWebView` - o fluxo OAuth2 roda normalmente, o backend nunca
   percebe diferença entre navegador e app.
2. Quando a WebView chega em `/auth/me` (sinal de que o login terminou), o
   app lê o cookie `connect.sid` do cookie jar nativo da WebView
   (`CookieManager` do `flutter_inappwebview`) e guarda via
   `flutter_secure_storage` (Keystore/Keychain - nunca `SharedPreferences`
   puro, ver skill `design-system`).
3. Esse cookie é anexado automaticamente em toda chamada `ApiClient`
   seguinte (interceptor do Dio).
4. Logout (`AuthNotifier.logout()`) abre `/auth/logout` numa
   `HeadlessInAppWebView` (sem UI) antes de limpar a sessão local - sem
   isso, a sessão do IdP continuaria viva e o próximo login reautenticaria
   silenciosamente sem pedir credencial.

## Estrutura

```
lib/
  core/
    auth/        # IdpUser, SessionStorage, AuthNotifier, LogoutService
    api_client.dart, health_provider.dart
  theme/         # Tokens de cor e ThemeData (mesmos tokens do design system web)
  screens/       # Telas (ConsumerWidget, "burras" - lógica fica nos providers)
  widgets/       # Componentes visuais compartilhados
```

Segue a convenção de separação UI/estado documentada nas skills
`flutter-widget` e `flutter-ui-ux` do projeto.
