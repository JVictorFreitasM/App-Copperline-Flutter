# OSs Pendentes — Backend

Arquivo de continuidade — ver `PROJECT-STATUS.md` na raiz do projeto para o
status geral de todas as frentes. Este arquivo cobre só o que falta no
backend.

---

# OS-BACKEND-13 — Expor leitura de nota fiscal

## Objetivo
Expor via API o dado de nota fiscal já sincronizado (OS-BACKEND-09),
seguindo o mesmo padrão da OS-BACKEND-11 (cliente/produto/pedido).

## Escopo
- `GET /notas-fiscais` (lista, com paginação e filtro básico — número,
  cliente, tipo Entrada/Saída, situação fiscal) e `GET /notas-fiscais/:id`.
- Resposta inclui `chave` (chave de acesso), `pedidos` vinculados (nome/
  número, não só ID), status fiscal (`nfe.status`/`nfse`).
- Protegido por `requireAuth`, mesmo padrão das demais.

## Fora de escopo
- Qualquer endpoint de escrita.
- Nenhuma alteração na sincronização em si (OS-BACKEND-09 já está correta,
  com a janela de 60 dias) — esta OS só expõe o que já está no banco.

## Nota importante
Como a sincronização (OS-BACKEND-09) só cobre os últimos 60 dias, este
endpoint naturalmente só vai devolver notas fiscais desse período — não é
limitação desta OS, é herdada da decisão já tomada na sincronização. Vale
deixar isso claro na resposta da API ou na documentação, para não parecer
que "sumiu" uma nota fiscal mais antiga.

## Dependências
OS-BACKEND-09 (dado sincronizado), OS-BACKEND-02/03 (autenticação/guards).

## Skills envolvidas
`nest-endpoint`, `nestjs`.

## Critérios de aceite
- `GET /notas-fiscais` retorna as notas dos últimos 60 dias, paginado.
- `pedidos` vinculados aparecem com nome/número resolvido, não só ID cru.
- Endpoint exige autenticação — chamada sem sessão retorna 401.

---

# OS-BACKEND-14 — Sincronização agendada de estoque (snapshot completo)

## Objetivo
Complementar a consulta on-demand de estoque (OS-BACKEND-12) com uma
sincronização agendada que grava um snapshot completo do saldo de estoque
no Postgres — permitindo consultas históricas/agregadas sem depender de
uma chamada em tempo real ao WK BI a cada vez.

## Escopo
- `estoque.sync.ts`, reaproveitando o scheduler/processor/service genéricos
  já existentes (desde a OS-BACKEND-05), mas usando o módulo `wk-bi-client`
  (não o `erp-client` REST) — ver skill `wk-radar-bi-client`, "Padrão 2".
- Chama `BuscarRelatorioExportacaoAutomatica` com `CodProdutos=""` (traz
  todos os produtos do relatório de uma vez).
- **Sem cursor de alteração** — este relatório é sempre o saldo atual
  completo, não "o que mudou". Cada execução é um **full refresh**: o
  snapshot anterior é substituído inteiro, não é feito upsert incremental
  por `sincronizado_em`.
- Tabela `estoque_saldo` no Prisma. Como o relatório não retorna um ID de
  registro do WK Radar, a chave natural é a combinação `Cod.` (código do
  produto) + `Lote` + local de estocagem (confirmar se local de estocagem
  vem no relatório completo — nos testes até agora só vimos consulta
  filtrada por um produto único, não a resposta do relatório sem filtro).
- Intervalo do cron a ser definido com o time de negócio (não é decisão
  técnica) — saldo de estoque muda com frequência, mas rodar com frequência
  demais pode sobrecarregar o WK Radar.

## Fora de escopo
- Qualquer mudança na consulta on-demand (OS-BACKEND-12) — ela continua
  existindo em paralelo, sem depender deste snapshot.
- Endpoint que lê a tabela `estoque_saldo` (seria uma OS de exposição de
  leitura separada, como a BACKEND-11/13 fizeram para os outros recursos).

## Pendências a resolver durante a implementação (não bloqueiam o início)
- Confirmar se o snapshot completo tem os mesmos campos da consulta
  filtrada por um produto, ou se traz campos adicionais (ex: local de
  estocagem explícito).
- Confirmar se existe paginação no relatório completo — um catálogo grande
  de produtos pode gerar uma resposta muito grande numa chamada só.

## Dependências
OS-BACKEND-05 (scheduler/processor/service genéricos), módulo `wk-bi-client`
(criado na OS-BACKEND-12, se ainda não existir de forma reutilizável).

## Skills envolvidas
`wk-radar-bi-client` (seção "Padrão 2 — Sincronização agendada"), `nestjs`.

## Critérios de aceite
- Job agendado roda no intervalo definido e grava o snapshot completo.
- Execução repetida substitui o snapshot anterior corretamente (não
  duplica, não acumula lixo de execuções antigas).
- `sync_logs` populado, incluindo contagem de linhas do snapshot.
- Chave de identificação de cada linha (`Cod.` + `Lote` + local) definida e
  documentada, resolvendo a pendência de modelagem antes de considerar a
  OS concluída.
