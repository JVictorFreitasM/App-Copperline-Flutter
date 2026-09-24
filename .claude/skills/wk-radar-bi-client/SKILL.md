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

Executa um relatório automático já salvo no WK Radar (configurado pelo lado do WK, não por nós).

**Correção importante (2026-09-22, confirmada via teste real contra a base "teste" recriada): o campo `Hash` NÃO é necessário no `config`.** A documentação anterior descrevia um `Hash` fixo por modelo de relatório como obrigatório — isso estava errado, ou pelo menos não é mais verdade nesta base. Evidência: com login válido e `Empresa` correto, incluir um `Hash` desatualizado/inválido faz a chamada falhar com `IdMensagem=2273` (`"Erro ao verificar informações de autenticação"`) — um erro que soa como problema de credencial, mas na real é o `Hash` quebrando a autenticação interna do próprio motor de relatório. **Omitir o campo `Hash` inteiramente resolve** — a mesma chamada, sem `Hash`, funciona e devolve dados reais. Nunca reintroduzir esse campo sem testar de novo contra o ambiente real; se for readicionado, documentar a razão concreta aqui.

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
CodGrades, CodItensGrades, ListarSubordinados
```

(sem `Hash` — ver correção acima.)

- **`CodProdutos`**: string vazia `""` traz **todos os produtos** do relatório (usar isso na sincronização agendada) — um ou mais códigos filtra só esses (usar na consulta on-demand).
- **`ArquivoExportacao`**: caminho de arquivo no servidor WK — aparenta ser um artefato interno do motor de relatório; a resposta HTTP já traz os dados, não é preciso ler esse arquivo separadamente.
- O caminho (`C:\WKRadar\...`) precisa ir com barras duplicadas dentro do JSON final (`buildWkBiReportConfig` não escapa isso sozinho — quem serializa pra JSON no final da cadeia é que cuida disso, ex: `JSON.stringify` já faz automaticamente se a string com `\` for montada corretamente em memória, não como literal já escapado).

### Formato da resposta

**Sucesso**: array de objetos, um por linha do relatório. Nomes de campo vêm do próprio relatório, não são um contrato estável da API — para o modelo de saldo de estoque, confirmados via chamada real (consulta on-demand, produto `50039`, 2026-09-22): `"Cod."`, `"Produto"`, `"Qtde Estoque"`, `"Lote"`, `"Fabricado Em"`, `"Código Local"`, `"Nome do Local"` (**atenção**: nomes com ponto/espaço — acessar via colchete, `linha["Cod."]`, nunca `linha.Cod.`). `Qtde Estoque` vem como string com vírgula decimal (ex: `"15,4000"`) — usar o parser BR já existente no projeto (`common/parse-decimal-br.ts`), nunca `Number()`/`parseFloat()` direto. `Lote` tem formato `MMAA-NNNNNN-S` (ex: `"0826-000119-3"`, mês/ano-sequência-sufixo); `Fabricado Em` no formato `DD/MM/YYYY`, igual ao `dataEmissao` de pedido.

**Sem dados**: resposta contém `error.message` igual a `"Não existem dados para o relatório solicitado"` — tratar como lista vazia no código, não como exceção/erro de fato. Qualquer outro conteúdo em `error` é erro real (relatório não encontrado, `Empresa` incorreto, `IdMensagem=2273` "erro ao verificar informações de autenticação" — este último é sintoma de `Hash` inválido enviado por engano, ver correção acima; a correção é remover o campo, nunca gerar um novo) e deve propagar como falha.

## Padrão 1 — Consulta on-demand (estoque de um produto específico)

Fluxo completo, replicando o que já roda em produção (bot de WhatsApp via n8n), mas como módulo do nosso backend:

1. Receber identificador do produto — **aceitar tanto `Codigo` quanto `Id`** (decisão do projeto: os dois são válidos, dependendo do que o cliente da nossa API mandar).
   - Se vier `Id`: primeiro `GET /empresarial/v1/produto/{id}` (skill `wk-radar-client`) para obter o `codigo` do produto — o relatório de estoque filtra por `CodProdutos`, que é sempre código, nunca `id`.
   - Se vier `Codigo`: pode ir direto pro passo 2, mas validar a existência do produto antes é recomendado (`GET /produto?Codigo=X`) — evita rodar o relatório de estoque para um código que nem existe, e devolve uma mensagem de erro mais clara ("produto não encontrado" em vez de "sem estoque", que são coisas diferentes).
2. Montar `config` com `CodProdutos = <codigo resolvido>` (sem `Hash`, ver correção acima).
3. Chamar `BuscarRelatorioExportacaoAutomatica`.
4. Se `error.message` bater com "sem dados": produto existe mas não tem saldo — resposta é "sem estoque", não erro.
5. Caso contrário: retornar as linhas (uma por lote/local de estocagem, conforme o modelo do relatório).

Este fluxo é uma **chamada síncrona sob demanda** — não grava nada no Postgres, não usa scheduler/processor/`sync_logs`. É um endpoint comum (`GET /estoque/:identificador` ou similar), não uma sincronização.

## Padrão 2 — Sincronização agendada (snapshot completo)

Mesma operação (`BuscarRelatorioExportacaoAutomatica`), mas com `CodProdutos=""` (traz tudo) e rodando em cron, seguindo a arquitetura de sync do projeto (skill `nestjs`) — com uma diferença importante:

- **Sem cursor de "alterado desde"**, assim como `nota-fiscal` — o relatório sempre traz o saldo atual completo, não "o que mudou". A strategy de sync aqui não é incremental por natureza: cada execução é um **full refresh** da tabela de estoque (substituir o snapshot anterior inteiro, não fazer upsert incremental por `sincronizado_em`).
- Ainda assim, seguir o restante do padrão: `sync.scheduler.ts` (cron, ex: a cada X horas — saldo de estoque muda com frequência, decidir intervalo com o time de negócio), `sync.processor.ts`, `sync.service.ts` grava em `sync_logs` (contagem de linhas do snapshot, sucesso/erro), e uma strategy dedicada (`estoque.sync.ts`) que chama esse relatório em vez de um recurso REST.
- Tabela de destino não tem `id_externo_erp` no sentido usual (o relatório não retorna um ID de registro do WK Radar) — a chave natural é a combinação `Cod.` + `Lote` + `Código Local` (local de estocagem já confirmado presente na resposta, ver seção "Formato da resposta" — resolvida a pendência de saber se viria explícito).

## Achados confirmados via teste real (2026-09-22, ambiente `teste`)

- **`CodProdutos` com valor inválido ou lista (vírgula) não filtra nada — devolve o catálogo inteiro, sem erro.** Testado: código único válido filtra certo; `"50039,50010"` (vírgula) e um código inexistente (`99999999`) devolveram as 3879 linhas do catálogo completo, silenciosamente; `;` (ponto-e-vírgula) quebra o parser pseudo-INI e dá erro explícito (`Falha ao gerar relatório... arquivo de configuração não está estruturado corretamente`), porque `;` é o separador de campo do próprio formato. **Consequência de segurança**: todo caller precisa validar o código do produto contra o cadastro (`GET /produto?Codigo=X`) antes de montar o `config` — nunca repassar direto o que o usuário digitou, porque um código errado não retorna vazio, retorna os dados de *todos os outros produtos*. Não existe filtro nativo por múltiplos produtos numa chamada só (uma chamada por produto, ou usar o snapshot completo e filtrar em memória).
- **`ImprimirTotalizacao="1"` não altera a resposta JSON** (mesmas linhas, sem linha de total agregado) — o flag parece afetar só um arquivo `.txt` que o WK Radar grava no próprio servidor (`ArquivoExportacao`), nunca lido por nós. Não é um caminho para obter total agregado do relatório.
- **Snapshot completo (`CodProdutos=""`) confirmado**: 3879 linhas, 374 produtos distintos, 92 locais distintos, ~1MB, ~28s numa chamada só, sem paginação. Mesmos 7 campos da consulta filtrada (nenhum campo adicional). Viável rodar em cron sem se preocupar com paginação/timeout (bem mais rápido que os "quase 4 minutos" citados anteriormente como pior caso — aquele tempo era de uma versão anterior do teste, não reflete o comportamento atual confirmado).
- **`Código Local` ↔ `Nome do Local` é 1:1 limpo** (92 códigos, cada um com exatamente um nome, sem ambiguidade) — confirma a chave natural `Cod.` + `Lote` + `Código Local`.
- **Um mesmo produto aparece em vários locais**, não só em "Estoque" (código 6021, o armazém principal) — produtos podem estar espalhados por posições internas de produção (`P4-2.3.1`, `P17-4.2.1` etc.) e racks (`R1`-`R9`), além do armazém principal. **Decisão de negócio pendente**: telas que mostram "estoque por lote" devem escopar só pro local "Estoque" (venda) ou mostrar todos os locais (incluindo posições de produção)?
- **`QuantidadeDisponivel` (outro serviço, `Estoque.svc/BuscarSaldoProduto`, já em uso via `EstoqueSvcClientService`) NÃO é a soma física dos lotes deste relatório** — são métricas diferentes por design, não uma inconsistência a corrigir. `QuantidadeDisponivel` = saldo físico líquido de pedidos comprometidos em aberto (por isso pode ficar bem negativo numa base de teste com pedidos sem estoque real por trás, como confirmado pelo usuário). A soma de `Qtde Estoque` por `Cod.` neste relatório é o saldo físico bruto, sem considerar reserva/comprometido. **Não usar um como proxy do outro** — se a tela precisa dos dois conceitos (físico vs. disponível pra venda), buscar cada um do serviço correto e rotular como coisas diferentes.

## Pendências

- **Decidir o intervalo do cron** da sincronização agendada com o time de negócio (não é uma decisão técnica).
- **Decidir escopo de locais** a exibir na busca de produto com lotes (só "Estoque" ou todos os locais internos) — ver achado acima.
- **Decidir qual métrica exibir como "estoque total"** na busca de produto — soma dos lotes (físico bruto) vs. `QuantidadeDisponivel` (líquido de comprometido) — ou os dois, rotulados de forma distinta.
