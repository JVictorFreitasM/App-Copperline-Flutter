# Documentação — App Copperline

Documentação funcional do sistema, escrita para quem acompanha o produto do
ponto de vista de negócio (gestores, área comercial, stakeholders), sem
detalhar implementação técnica (endpoints, schemas de banco, DTOs). Para
esse nível de detalhe, o código-fonte é a fonte de verdade.

## Índice

1. [Visão geral](01-visao-geral.md) — o que é o sistema, para quem, e como as
   partes se encaixam.
2. [Módulos funcionais](02-modulos-funcionais.md) — o que cada área do
   sistema faz, por domínio de negócio.
3. [Telas — portal web e app mobile](03-telas-web-mobile.md) — o que o
   usuário consegue fazer em cada tela.
4. [Integração com o ERP e o BI de estoque](04-integracao-erp.md) — de onde
   vêm os dados e com que frequência são atualizados.
5. [Autenticação e controle de acesso](05-autenticacao-e-acesso.md) — como o
   login funciona e como o acesso é restrito por perfil.
6. [Infraestrutura](06-infraestrutura.md) — como o sistema roda em produção.
7. [Instalação — do zero](07-instalacao.md) — guia técnico para clonar o
   repositório e rodar tudo localmente (backend, frontend, mobile, IdP).

Ver também [casos-de-uso-ia.md](casos-de-uso-ia.md) — análise de onde IA
(LLM) já está aplicada no sistema e onde faria ou não sentido aplicar.

> Este conjunto de documentos descreve o estado atual do sistema
> (2026-09-21), a partir da leitura do código-fonte. Funcionalidades novas
> tendem a desatualizar partes específicas — ao encontrar uma divergência,
> o código prevalece.
