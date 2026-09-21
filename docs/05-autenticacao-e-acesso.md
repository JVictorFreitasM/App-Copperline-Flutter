# Autenticação e controle de acesso

## Login único (SSO)

Todo login no App Copperline — portal web e app mobile — passa pelo
provedor de identidade central da empresa (mesmo login usado nos outros
sistemas internos). Não existe usuário/senha próprio do App Copperline: o
sistema confia na sessão validada pelo provedor central.

Consequência prática: se o acesso de alguém é desativado no provedor
central (ex: desligamento), o acesso a este sistema também é encerrado —
não há gestão de senha separada para lembrar.

## Como o acesso é restrito

O que cada pessoa vê e pode fazer depende do seu perfil e da sua posição na
hierarquia de vendedores, sempre validado no backend (nunca apenas
escondido na tela):

- **Vendedor** — vê e opera só sobre sua própria carteira de clientes e
  pedidos (mais a carteira de quem ele está cobrindo temporariamente, se
  houver uma cobertura ativa).
- **Supervisor/Gerente** — vê os dados da sua equipe (dashboard, metas,
  ranking), e pode aprovar solicitações de desconto que excedam a alçada de
  quem está abaixo dele na hierarquia.
- **Administrador** — acesso amplo: configurações do sistema, sincronização
  com o ERP, cadastros de apoio e documentos institucionais.

Esse controle vale tanto para o que aparece nas telas quanto para o que a
API aceita — um usuário não consegue, por exemplo, aprovar um desconto ou
ver dados de um cliente fora do seu escopo só porque conhece o identificador
do registro.
