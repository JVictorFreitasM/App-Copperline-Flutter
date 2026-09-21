# Visão geral

## O que é

O App Copperline é o sistema de apoio à equipe comercial (vendedores,
supervisores, gerentes e administradores): centraliza clientes, produtos,
preços, estoque, pedidos e notas fiscais vindos do ERP da empresa, e
adiciona em cima disso rotinas do dia a dia comercial que o ERP não cobre —
aprovação de desconto, metas e ranking, roteiro de visitas, rastreio de
equipe em campo, e um portal administrativo para configurar tudo isso.

Existe em duas frentes voltadas ao usuário final:

- **Portal web** — usado principalmente por gestores e pela área
  administrativa (dashboards, aprovações, configuração).
- **App mobile (Flutter)** — usado pelo vendedor em campo, com suporte a uso
  offline (funciona sem internet e sincroniza depois).

## Como as partes se encaixam

```
        ┌─────────────┐        ┌──────────────┐
        │  Portal web │        │  App mobile  │
        │  (Next.js)  │        │  (Flutter)   │
        └──────┬──────┘        └──────┬───────┘
               │        API REST      │
               └───────────┬──────────┘
                            ▼
                   ┌─────────────────┐
                   │  Backend NestJS │
                   │ (regras de      │
                   │  negócio)       │
                   └────────┬────────┘
                 ┌──────────┼───────────┐
                 ▼          ▼           ▼
           ┌──────────┐ ┌───────┐ ┌───────────────┐
           │ Postgres │ │ Redis │ │  WK Radar /   │
           │ (dados)  │ │(fila/ │ │  WK BI (ERP)  │
           │          │ │cache) │ │               │
           └──────────┘ └───────┘ └───────────────┘
```

Pontos importantes desse desenho:

- **O ERP continua sendo a fonte de verdade** para cliente, produto, pedido,
  nota fiscal, estoque, tabela de preço e pagamento. O sistema não substitui
  o ERP — ele importa esses dados periodicamente (ver
  [Integração com o ERP](04-integracao-erp.md)) para oferecer telas mais
  rápidas, dashboards e funcionalidades que o ERP não tem.
- **Nem tudo é uma via de mão única.** Pedidos criados no App Copperline são
  enviados de volta ao ERP — é o único fluxo de escrita no sentido
  sistema → ERP hoje.
- **O portal web e o app mobile nunca acessam o banco de dados
  diretamente** — tudo passa pela API do backend, que é quem aplica as
  regras de negócio (quem pode aprovar que desconto, quem vê os dados de
  quem, etc.).
- **O login é único para toda a empresa** (SSO) — ver
  [Autenticação e controle de acesso](05-autenticacao-e-acesso.md).

## Para quem é cada parte

| Perfil | Onde atua | O que faz principalmente |
|---|---|---|
| Vendedor | App mobile | Consulta cliente/produto/estoque, cria pedido, registra visita, acompanha aprovação de desconto |
| Supervisor/Gerente | Portal web (e mobile) | Acompanha dashboard da equipe, aprova descontos que excedem a alçada do vendedor, acompanha rastreio da equipe |
| Administrador | Portal web | Configura alçadas, sincronização com ERP, cadastros de apoio (pagamento, embalagem), documentos institucionais |
