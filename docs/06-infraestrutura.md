# Infraestrutura

O sistema roda como um conjunto de serviços independentes (containers), o
que permite atualizar/reiniciar uma parte sem derrubar as outras.

## Serviços

| Serviço | Papel |
|---|---|
| **Postgres** | Banco de dados relacional — guarda todos os dados de negócio já sincronizados do ERP e os gerados pelo próprio sistema (pedidos, aprovações, visitas, rastreio etc.) |
| **Redis** | Cache e fila de processamento em segundo plano — usado pelo motor de sincronização com o ERP e pelo envio de notificações |
| **Backend (NestJS)** | API que concentra toda a regra de negócio, a autenticação e a orquestração da sincronização com o ERP/BI |
| **Frontend (Next.js)** | Portal web usado por vendedores, gestores e administradores |

O app mobile não é um serviço desta infraestrutura — é instalado no
aparelho do vendedor e se conecta à mesma API do backend.

## O que é persistido entre reinícios

Além do banco de dados, ficam guardados de forma persistente (não se perdem
ao reiniciar um container):

- Fotos de check-in de visita
- Documentos institucionais enviados por administradores
- Imagens de produto enviadas por administradores

## Dependências externas

O backend depende de conectividade com dois sistemas externos para manter
os dados atualizados e permitir a criação de pedidos:

- **WK Radar** (ERP) — cliente, produto, pedido, nota fiscal, vendedor,
  pagamento.
- **WK BI** — estoque, tabela de preço e situação financeira do cliente.

Ver [Integração com o ERP](04-integracao-erp.md) para o detalhe de cada
fluxo.
