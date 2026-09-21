# Integração com o ERP e o BI de estoque

O sistema não substitui o ERP da empresa — ele importa periodicamente os
dados que precisa, para oferecer telas mais rápidas e funcionalidades que o
ERP não cobre. Essa importação é chamada de **sincronização**.

## De onde vêm os dados

- **WK Radar** (ERP, módulos Comercial e Empresarial) — origem de cliente,
  vendedor, forma/condição de pagamento, nota fiscal, produto e pedido.
- **WK BI** — serviço separado, usado hoje para saldo de estoque (via
  `Estoque.svc`) e tabela de preço (via `Empresarial.svc`); tem autenticação
  própria, diferente do WK Radar.
- **Financeiro (WK BI)** — posição financeira/boletos do cliente. Diferente
  dos demais, esse dado é consultado **na hora**, quando a tela do cliente é
  aberta — não fica salvo localmente, porque muda a cada pagamento.

## Com que frequência cada dado é atualizado

| Dado | Origem | Frequência |
|---|---|---|
| Cliente | WK Radar | A cada 30 minutos |
| Vendedor | WK Radar | Diariamente |
| Forma de pagamento | WK Radar | Diariamente |
| Condição de pagamento | WK Radar | Diariamente |
| Nota fiscal | WK Radar | Diariamente, de madrugada |
| Produto | WK Radar | 1x por dia, à noite |
| Pedido | WK Radar | 1x por dia, à noite |
| Saldo de estoque | WK BI | Configurável pelo administrador |
| Tabela de preço | WK BI | Configurável pelo administrador (recarga completa) |
| Situação financeira/boletos | WK BI | Em tempo real, sob demanda (não é sincronização agendada) |

Um administrador pode acompanhar essas execuções e ajustar a frequência de
estoque e tabela de preço na tela **Sincronização** do portal (ver
[Telas](03-telas-web-mobile.md)).

## O que acontece quando algo muda no ERP

- A maioria das entidades busca **só o que mudou** desde a última
  sincronização (sincronização incremental).
- Nota fiscal e alguns cadastros não têm essa informação disponível no ERP,
  então o sistema reprocessa uma janela de tempo retroativa por segurança.
- Pedidos e produtos, por serem consultados com menos urgência, rodam à
  noite para não competir com o uso do sistema durante o dia.

## Sentido do fluxo de dados

Hoje a sincronização é **de mão única**: o ERP é sempre a origem, e o App
Copperline só lê. A única exceção é o **pedido**, que é criado no App
Copperline (web ou mobile) e enviado de volta ao ERP — esse é o único fluxo
de escrita no sentido sistema → ERP.
