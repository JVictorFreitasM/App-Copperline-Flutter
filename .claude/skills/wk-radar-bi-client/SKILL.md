---
name: wk-radar-bi-client
description: |
  Documenta a integração com o motor de relatórios do WK BI (serviço WCF Executivo.svc, binding JSON) — usado hoje para consulta de saldo de estoque. Cobre autenticação própria (diferente da API REST do WK Radar), construção do config pseudo-INI, formato de resposta e erro, e os dois padrões de consumo: consulta on-demand e sincronização agendada (full refresh).
  Use quando: implementar ou revisar consulta de estoque, qualquer relatório do WK BI via Executivo.svc, construir a string `config` de um relatório automático, ou decidir entre consulta em tempo real vs. sincronização agendada para dado que vem desse serviço.
---

# WK BI — Relatórios via Executivo.svc

Serviço **separado** da API REST do WK Radar documentada na skill `wk-radar-client`. É um serviço WCF legado (SOAP nativo, mas com um binding JSON adicional habilitado no servidor) que executa relatórios **já salvos** no WK Radar e devolve o resultado. Hoje usado para saldo de estoque; o mesmo mecanismo serve para qualquer relatório do módulo Executivo.

**Não reaproveitar o `erp-client` da API REST aqui** — autenticação, protocolo e formato de erro são todos diferentes. Este serviço precisa do seu próprio módulo (`wk-bi-client`, nome sugerido).

## Diferenças-chave em relação à API REST (`wk-radar-client`)

| | API REST (`wk-radar-client`) | WK BI (`wk-radar-bi-client`) |
|---|---|---|
| Endpoint base | `{host}/wk.api/api/{modulo}/v1/{recurso}` | `{host}/RadarWebWebServices/Areas/Executivo/Executivo.svc/json/{operacao}` |
| Autenticação | `POST /api/v1/token` → Bearer token | `Login` embutido em cada chamada (`Base`, `Usuario`, `Senha`) — sem token |
| Payload de login | `{ empresa, nomeUsuario, senha, idIntegrador }` | `{ Base, Usuario, Senha, Guid }` |
| Usuário usado | Usuário de sistema da integração REST (ex: `sistema-integracao`) | Pode ser um usuário **diferente**, dedicado a relatórios (ex: `sistema-relatorios`) — confirmar com quem administra o WK Radar se deve ser o mesmo ou não |
| Resposta | JSON estruturado conforme o schema do recurso | JSON — **array de linhas do relatório**, campos definidos pelo modelo do relatório, não por um schema fixo da API |
| Erro "sem dados" | N/A (lista vazia) | Resposta traz `error.message` contendo o texto `"Não existem dados para o relatório solicitado"` — tratar como resultado vazio, não como falha |

## Autenticação

Sem endpoint de token — o login vai embutido em toda chamada:

```json
{
  "login": { "Base": "empresa", "Usuario": "usuario", "Senha": "senha" },
  "config": "..."
}
```

Variáveis de ambiente próprias, **separadas** das da API REST (`WK_RADAR_*`), para não confundir os dois usuários se forem diferentes:

```
WK_BI_URL=http://.../RadarWebWebServices/Areas/Executivo/Executivo.svc/json
WK_BI_BASE=
WK_BI_USUARIO=
WK_BI_SENHA=
```

## Operação: `BuscarRelatorioExportacaoAutomatica`

Executa um relatório automático já salvo no WK Radar (configurado pelo lado do WK, não por nós). Cada relatório salvo tem um **`Hash`** fixo — não é gerado por chamada, é a assinatura do modelo de relatório salvo no WK Radar. Um `Hash` por modelo de relatório, armazenado como env var própria (ex: `WK_BI_HASH_SALDO_ESTOQUE`), nunca hardcoded no meio do código.

### Montagem do `config`

O campo `config` é uma string **pseudo-INI** (`"Chave"="Valor";...`), não JSON aninhado — mesmo estando dentro de um corpo JSON. Construir com uma função utilitária dedicada, nunca concatenando string manualmente em cada call site (dois pontos de escaping fáceis de errar: aspas duplas do próprio formato pseudo-INI viram `\"` dentro do JSON, e barras invertidas de caminho de arquivo viram `\\`).

```ts
function buildWkBiReportConfig(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([chave, valor]) => `"${chave}"="${valor}"`)
    .join(';') + ';';
}
```

Parâmetros confirmados para o relatório de saldo de estoque (modelo **"Saldo de Produtos por Local de Estocagem - BOT"**, `Relatorio=GerencialSaldoEstoque`):

```
ArquivoExportacao, Separador, EliminarCaracteres, GerarSemAspas, ExpCabecalhoColunas,
SimboloDecimal, SimboloAgrupamento, Modulo="ES", Empresa, Modelo, Relatorio, Versao,
DataFinal, Filial, Locais, TipoEstoque, ImprimirSaldosZerados, TabPrecos,
ListarApenasNaoMovimentados, DataListarApenasNaoMovimentados, NaoImprimeProdutosInativos,
DataVencimentoInicial, DataVencimentoFinal, ImprimirTotalizacao,
ImprimirLinhaEmBrancoTotalizacao, Ordenacao, CodProdutos, CodItensGradeProduto1/2/3,
CodGrades, CodItensGrades, ListarSubordinados, Hash
```

- **`CodProdutos`**: string vazia `""` traz **todos os produtos** do relatório (usar isso na sincronização agendada) — um ou mais códigos filtra só esses (usar na consulta on-demand).
- **`ArquivoExportacao`**: caminho de arquivo no servidor WK — aparenta ser um artefato interno do motor de relatório; a resposta HTTP já traz os dados, não é preciso ler esse arquivo separadamente.
- O caminho (`C:\WKRadar\...`) precisa ir com barras duplicadas dentro do JSON final (`buildWkBiReportConfig` não escapa isso sozinho — quem serializa pra JSON no final da cadeia é que cuida disso, ex: `JSON.stringify` já faz automaticamente se a string com `\` for montada corretamente em memória, não como literal já escapado).

### Formato da resposta

**Sucesso**: array de objetos, um por linha do relatório. Nomes de campo vêm do próprio relatório, não são um contrato estável da API — para o modelo de saldo de estoque confirmados: `"Cod."`, `"Produto"`, `"Lote"`, `"Fabricado Em"`, `"Qtde Estoque"` (**atenção**: nomes com ponto/espaço — acessar via colchete, `linha["Cod."]`, nunca `linha.Cod.`).

**Sem dados**: resposta contém `error.message` igual a `"Não existem dados para o relatório solicitado"` — tratar como lista vazia no código, não como exceção/erro de fato. Qualquer outro conteúdo em `error` é erro real (ex: `Hash` inválido, relatório não encontrado) e deve propagar como falha.

## Padrão 1 — Consulta on-demand (estoque de um produto específico)

Fluxo completo, replicando o que já roda em produção (bot de WhatsApp via n8n), mas como módulo do nosso backend:

1. Receber identificador do produto — **aceitar tanto `Codigo` quanto `Id`** (decisão do projeto: os dois são válidos, dependendo do que o cliente da nossa API mandar).
   - Se vier `Id`: primeiro `GET /empresarial/v1/produto/{id}` (skill `wk-radar-client`) para obter o `codigo` do produto — o relatório de estoque filtra por `CodProdutos`, que é sempre código, nunca `id`.
   - Se vier `Codigo`: pode ir direto pro passo 2, mas validar a existência do produto antes é recomendado (`GET /produto?Codigo=X`) — evita rodar o relatório de estoque para um código que nem existe, e devolve uma mensagem de erro mais clara ("produto não encontrado" em vez de "sem estoque", que são coisas diferentes).
2. Montar `config` com `CodProdutos = <codigo resolvido>` e o `Hash` do modelo de saldo de estoque.
3. Chamar `BuscarRelatorioExportacaoAutomatica`.
4. Se `error.message` bater com "sem dados": produto existe mas não tem saldo — resposta é "sem estoque", não erro.
5. Caso contrário: retornar as linhas (uma por lote/local de estocagem, conforme o modelo do relatório).

Este fluxo é uma **chamada síncrona sob demanda** — não grava nada no Postgres, não usa scheduler/processor/`sync_logs`. É um endpoint comum (`GET /estoque/:identificador` ou similar), não uma sincronização.

## Padrão 2 — Sincronização agendada (snapshot completo)

Mesma operação (`BuscarRelatorioExportacaoAutomatica`), mas com `CodProdutos=""` (traz tudo) e rodando em cron, seguindo a arquitetura de sync do projeto (skill `nestjs`) — com uma diferença importante:

- **Sem cursor de "alterado desde"**, assim como `nota-fiscal` — o relatório sempre traz o saldo atual completo, não "o que mudou". A strategy de sync aqui não é incremental por natureza: cada execução é um **full refresh** da tabela de estoque (substituir o snapshot anterior inteiro, não fazer upsert incremental por `sincronizado_em`).
- Ainda assim, seguir o restante do padrão: `sync.scheduler.ts` (cron, ex: a cada X horas — saldo de estoque muda com frequência, decidir intervalo com o time de negócio), `sync.processor.ts`, `sync.service.ts` grava em `sync_logs` (contagem de linhas do snapshot, sucesso/erro), e uma strategy dedicada (`estoque.sync.ts`) que chama esse relatório em vez de um recurso REST.
- Tabela de destino não tem `id_externo_erp` no sentido usual (o relatório não retorna um ID de registro do WK Radar) — a chave natural é a combinação `Cod.` + `Lote` + local de estocagem (se disponível no relatório completo; confirmar quando implementar, já que os campos vistos até agora vieram de uma consulta filtrada por um produto único).

## Pendências

- **Confirmar se o snapshot completo (`CodProdutos=""`) tem os mesmos campos** da consulta filtrada por um produto, ou se traz campos adicionais (ex: local de estocagem explícito, que não apareceu nos campos vistos até agora só porque a consulta de teste era de um produto específico).
- **Confirmar se existe paginação** no relatório completo — um catálogo grande de produtos pode gerar uma resposta muito grande numa chamada só.
- **Decidir o intervalo do cron** da sincronização agendada com o time de negócio (não é uma decisão técnica).
