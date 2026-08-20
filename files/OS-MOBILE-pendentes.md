# OSs Pendentes — Mobile

Arquivo de continuidade — ver `PROJECT-STATUS.md` na raiz do projeto para o
status geral de todas as frentes. Este arquivo cobre só o que falta no
mobile — que é a frente inteira, ainda pausada por decisão do projeto (foco
em fechar o web primeiro).

---

# OS-MOBILE-11 — Bootstrap do app mobile (Flutter)

## Objetivo
Criar a base do app mobile: projeto Flutter configurado, Riverpod, e a
camada de comunicação com o backend — sem nenhuma tela de negócio ainda,
equivalente à OS-WEB-08 (bootstrap web), mas para o Flutter.

## Escopo
- `flutter create`, estrutura de pastas seguindo a skill `flutter-widget`
  (separação entre UI e providers Riverpod).
- `ProviderScope` configurado na raiz do app.
- Um `ApiClient` (ou provider equivalente) que já injeta a URL base da API
  e trata erro de forma consistente — mesma ideia da função utilitária de
  fetch que a OS-WEB-08 criou pro Next.js, só que do lado Flutter.
- Tela inicial mínima que só confirma que o app fala com o backend
  (equivalente ao health check).

## Fora de escopo
- Autenticação no mobile (OS-MOBILE-12, reaproveitando o mesmo `idp-client`
  do lado do backend — o app não fala com o IdP diretamente).
- Qualquer tela de negócio.

## Dependências
OS-BACKEND-01 (backend precisa estar de pé).

## Skills envolvidas
`flutter-widget`, `flutter-ui-ux`, `design-system` (aplicar os mesmos
tokens visuais já usados no web, desde o início — ver skill
`design-system`, seção "Aplicação no Mobile").

## Critérios de aceite
- `flutter run` no dispositivo físico (ou emulador) sobe o app sem erro.
- Tela inicial confirma comunicação real com o backend.
- Nenhuma URL/credencial hardcoded — usa alguma forma de configuração por
  ambiente (ex: `--dart-define`).

---

## Tudo o resto ainda não tem escopo definido

Diferente do backend e do web, a frente mobile não tem nenhuma OS além do
bootstrap sequer esboçada. Quando o projeto decidir retomar essa frente,
os próximos passos naturais (seguindo o mesmo padrão do web) seriam:

- **Autenticação no mobile** (equivalente à OS-WEB-10) — login via SSO,
  reaproveitando o `idp-client` do backend, nunca falando com o IdP direto.
- **Telas de negócio** (equivalente às OS-WEB-11 a 15) — cliente, produto,
  pedido, estoque, provavelmente priorizando estoque primeiro no mobile
  (é o caso de uso que mais faz sentido em campo/depósito, como já vimos no
  workflow de WhatsApp que inspirou a consulta de estoque).

Nenhuma dessas foi escrita como OS formal ainda — fazer isso é o primeiro
passo ao retomar esta frente, não assumir que o escopo já está implícito
só porque o padrão do web existe.
