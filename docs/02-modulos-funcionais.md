# Módulos funcionais

Cada seção abaixo descreve uma área de negócio do sistema — o que ela
resolve, não como está implementada.

## Cadastros sincronizados do ERP

- **Clientes** — Visão 360° do cliente: dados cadastrais, situação
  financeira (boletos em aberto, consultados na hora), localização,
  histórico de interações e um resumo textual gerado por IA para apoiar o
  vendedor antes de uma visita (ver
  [casos-de-uso-ia.md](casos-de-uso-ia.md)).
- **Produtos** — Catálogo com preço, imagens, manuais técnicos e previsão de
  ruptura de estoque (quantos dias até um produto esgotar, calculado por
  regra a partir do consumo médio recente — não por IA).
- **Estoque** — Saldo disponível por produto.
- **Tabelas de preço** — Tabelas vindas do ERP e sua associação a clientes
  específicos, usadas para calcular o preço correto de cada produto por
  cliente.
- **Notas fiscais** — Histórico de notas emitidas e seu status.
- **Formas e condições de pagamento** — Usadas na criação de pedidos.
- **Tipos de acondicionamento** — Unidades/embalagens de produto (caixa,
  pallet etc.) usadas nos pedidos.

## Vendas

- **Pedidos** — Criação, consulta e acompanhamento de pedidos de venda,
  incluindo envio ao ERP e histórico de alterações de status.
- **Solicitações de desconto (alçada de aprovação)** — Quando um vendedor
  pede um desconto acima do que pode aprovar sozinho, o pedido sobe na
  hierarquia (supervisor → gerente, conforme o percentual) até alguém com
  alçada suficiente aprovar ou recusar.
- **Oportunidades** — Motor de sugestões para o vendedor: identifica
  situações como "cliente sem comprar há X dias", "produto que costuma ser
  recomprado" ou aniversário de relacionamento. A decisão de quando sugerir
  é sempre uma regra de negócio; IA só é usada para transformar o motivo já
  calculado em uma frase legível — nunca para decidir o quê sugerir.
- **Busca unificada** — Busca por nome/código entre clientes, produtos e
  pedidos em um único lugar.

## Gestão comercial

- **Dashboard** — Painéis gerenciais: funil de pedidos, ranking de
  vendedores, comparativo entre vendedores, mapa de calor de vendas,
  sazonalidade, notas fiscais e alertas de estoque crítico.
- **Metas e gamificação** — Definição de metas de vendas por vendedor e
  ranking de equipe. A visão é restrita por hierarquia: administrador vê
  tudo, supervisor/gerente vê só sua equipe.
- **Vendedores** — Hierarquia (quem reporta a quem), o que define o escopo
  de dados que cada um enxerga, e indicadores diários/semanais por
  vendedor.
- **Coberturas** — Quando um vendedor fica afastado, outro assume
  temporariamente sua carteira de clientes por um período definido.

## Campo

- **Visitas** — Agendamento e registro de visitas a clientes, com check-in
  por foto (validado) e vínculo ao histórico do cliente.
- **Rastreio** — Registro de localização da equipe em campo, usado para
  acompanhar roteiro e presença. A frequência de captura e o tempo de
  retenção dos dados são configuráveis pelo administrador.

## Suporte e administração

- **Configurações** — Parâmetros administrativos: alçada de aprovação de
  desconto, regras de criação de orçamento, política de rastreio e horário
  de trabalho dos vendedores.
- **Documentos** — Repositório de documentos institucionais (PDF, imagens,
  planilhas) disponibilizado aos usuários, com upload controlado por
  administradores.
- **Notificações** — Central de notificações/push (ex: desconto pendente de
  aprovação, eventos de pedido).
- **Sincronização (admin)** — Painel para acompanhar e ajustar a
  sincronização com o ERP/BI, com logs por execução — ver
  [Integração com o ERP](04-integracao-erp.md).
- **Usuários e autenticação** — Login único da empresa e perfis de acesso —
  ver [Autenticação e controle de acesso](05-autenticacao-e-acesso.md).

## Suporte ao app mobile

- **Snapshot/fila offline** — Ao abrir o app, o vendedor recebe um pacote
  consolidado de dados (clientes, produtos, pedidos, estoque) para uso sem
  internet. Ações feitas offline (ex: criar pedido) ficam numa fila local e
  são processadas quando a conexão volta — inclusive com uma tela dedicada
  para resolver conflitos, caso algo tenha mudado no servidor nesse meio
  tempo.
