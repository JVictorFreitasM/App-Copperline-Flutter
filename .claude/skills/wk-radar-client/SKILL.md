---
name: wk-radar-client
description: |
  Documenta a integração com a API do WK Radar Comercial/Empresarial (ERP WK) — autenticação, base de URLs, filtros de busca, estratégia de paginação por janela de tempo (a API não pagina nativamente) e estratégia de sincronização incremental para os recursos pedido, nota-fiscal, cliente e produto (schemas e filtros dos quatro confirmados). Aplica o padrão de sincronização com ERP já definido no projeto (scheduler/processor/service/strategy) especificamente a essa API.
  Use quando: implementar ou revisar a sincronização com o WK Radar, escrever qualquer `<recurso>.sync.ts` para pedido/nota-fiscal/cliente/produto, configurar autenticação com o WK Radar, decidir estratégia de filtro/incremental/paginação para um desses recursos.
---

# WK Radar API — Integração

API do ERP **WK Radar** (módulos Comercial e Empresarial). Sincronizada para o Postgres seguindo o padrão de referência já documentado na skill `nestjs` (seção "Arquitetura de Sincronização com ERP") — este documento cobre as especificidades da API do WK Radar em si; a arquitetura de scheduler/processor/service/strategy é a mesma, não é reinventada aqui.

**Não confundir com a skill `wk-radar-bi-client`**: esta skill (`wk-radar-client`) cobre a API REST do WK Radar (`wk.api/...`, autenticação por token). Consulta de estoque e outros relatórios do WK BI usam um serviço diferente (`Executivo.svc`, autenticação própria) — ver `wk-radar-bi-client`.

## Escopo atual

Só os recursos abaixo estão em escopo por enquanto — não sincronizar nada além disso sem confirmação:

| Recurso | Módulo | Rotas |
|---|---|---|
| Pedido | Comercial | `GET /pedido`, `GET /pedido/{id}` |
| Nota Fiscal | Comercial | `GET /nota-fiscal`, `GET /nota-fiscal/{id}` |
| Cliente | Empresarial | `GET /cliente`, `GET /cliente/{id}` |
| Produto | Empresarial | `GET /produto`, `GET /produto/{id}` |
| Vendedor | Empresarial | `GET /vendedor`, `GET /vendedor/{id}` |

## Base de URL

Padrão correto: `{host}/wk.api/api/{modulo}/v1/{recurso}`, onde `{modulo}` é `comercial` ou `empresarial`. O host é o servidor WK Radar da empresa (on-premise ou ambiente de testes) — configurar como env var (`WK_RADAR_API_URL`), nunca hardcoded (ver skill `security-review`, item "Segredos expostos").

O endpoint de autenticação segue o mesmo prefixo `api`, mas sem módulo: `{host}/wk.api/api/v1/token`.

## Autenticação (`POST /api/v1/token`)

```json
{
  "empresa": "string",
  "nomeUsuario": "string",
  "senha": "string",
  "idIntegrador": "string ou null"
}
```

- `empresa`, `nomeUsuario`, `senha`: obrigatórios.
- `idIntegrador`: opcional. Quando informado, vincula um `codigoIntegrador` personalizado aos registros gravados/consultados nessa sessão (ver seção "Ponte de ID externo" abaixo). Configurar mesmo sendo opcional, para habilitar o uso de `CodigosIntegrador` como filtro.
- Credenciais e `idIntegrador` vêm de variáveis de ambiente, nunca hardcoded.
- **Permissão por rota**: o usuário usado aqui precisa ter cada rota liberada explicitamente em `Empresarial > Adm. do Sistema > Usuários > Permissões`. Uma alteração de permissão pode levar até **10 minutos** para propagar — um `403` logo após liberar uma permissão pode ser essa janela, não necessariamente um erro de configuração.

## Ponte de ID externo (`codigoIntegrador` / `CodigosIntegrador`)

O WK Radar já tem um mecanismo nativo equivalente à nossa convenção `id_externo_erp` — só que na direção oposta:

- Cada registro do WK Radar (`pedido`, `nota-fiscal`, `cliente`, e até `contatos` aninhados) tem um campo `codigoIntegrador` — é onde **o nosso sistema** grava o próprio ID, no momento em que cria/atualiza o registro no WK Radar (se algum dia houver escrita, não é o caso hoje: hoje é leitura).
- Toda rota de busca aceita o filtro `CodigosIntegrador` (array) — permite buscar registros do WK Radar pelo **nosso** ID, sem precisar saber o `id` interno do WK Radar.
- Isso é o inverso da nossa convenção de sync: no nosso banco, `id_externo_erp` guarda o `id` do WK Radar. Não confundir os dois sentidos ao escrever a strategy.

## Filtros e estratégia de sincronização por recurso

Todo recurso aceita, além dos filtros específicos abaixo: `Ids` (array, filtra pelo ID do WK Radar — ID inválido/inexistente retorna `null` em vez de erro) e `Fields` (array, limita os campos retornados — usar para não trazer campos que não vamos mapear).

## Paginação (implementada pelo nosso lado — o WK Radar não pagina)

**Confirmado: nenhuma rota do WK Radar tem parâmetro de paginação** (sem `page`/`limit`/`offset`, sem contagem total, sem token de próxima página). Uma busca sem filtro restritivo o suficiente pode devolver um volume grande numa única resposta, sem aviso prévio de tamanho.

Como o WK Radar não resolve isso, a estratégia de paginação é responsabilidade da nossa strategy de sync — por **janela de tempo** (não por página/offset, que a API não suporta):

- Para recursos com par de datas (`cliente`: `DataHoraGravacaoInicial`/`Final`; `nota-fiscal`: `DataEmissaoInicial`/`Final`; `pedido` também tem `DataPedidoInicial`/`Final` como filtro alternativo ao cursor): dividir o intervalo total a sincronizar em sub-janelas menores (ex: 1 dia por chamada) e iterar sequencialmente, avançando a janela só depois de processar a anterior com sucesso.
- Para recursos com cursor único sem par (`pedido.DataHoraBaseAlteracao`, `produto.DataHoraAlteracao`): o "fim" da janela é implícito (o momento em que a chamada é feita). Para sub-dividir, a strategy calcula janelas artificiais entre o cursor salvo e "agora" (ex: se o cursor está 10 dias atrasado, iterar dia a dia até alcançar o presente, em vez de uma chamada só cobrindo os 10 dias).
- **Tamanho de janela configurável por recurso** (não assumir que 1 dia serve para todos — um recurso com muito volume de alteração por dia pode precisar de janelas menores, ex: por hora).
- **Sinal de alerta de truncamento silencioso**: se uma resposta vier com uma quantidade de registros suspeita de ser um limite arredondado não documentado (ex: exatamente 500, 1000, 5000), registrar isso em `sync_logs` como aviso e considerar reduzir o tamanho da janela — a API não avisa se truncou, então esse tipo de heurística é a única defesa disponível.
- Essa estratégia de janela também serve para a primeira carga completa (sem execução anterior): iterar por janelas desde uma data de início definida pelo negócio, não tentar buscar "tudo desde sempre" numa chamada só.

### Pedido (`GET /pedido`)

- **Cursor de incremental**: `DataHoraBaseAlteracao` (`date-time`, parâmetro único — funciona como "buscar tudo alterado a partir de"). É o recurso mais simples de sincronizar incrementalmente dos três.
- Outros filtros úteis: `Situacoes` (enum: `EmAnalise`, `Bloqueado`, `Pendente`, `Cancelado`, `ParcialmenteFaturado`, `Faturado`, `ParcialmenteAtendido`, `Atendido`), `DataPedidoInicial`/`Final`, `IdCliente`/`IdClientes`, `Origem` (enum incluindo `WebService` — relevante para identificar pedidos que vieram da nossa própria integração, se algum dia houver escrita).
- Campos-chave da resposta para a tabela de sync: `id` (→ `id_externo_erp`), `codigoIntegrador` (→ gravar nosso ID aqui quando/se houver escrita), `situacao`, `dataHoraUltimaAlteracao`, `dataHoraGravacao`, `idCliente` (referência ao recurso `cliente`), `itens[].produtoServico.id` (referência ao recurso `produto`, ainda pendente).
- O schema de resposta é extenso (tributos, rateios, liberações de estoque, faturamento, transporte) — mapear no Prisma só os campos que o sistema efetivamente vai usar; não é obrigatório persistir a árvore inteira. Consultar o schema completo (já compartilhado no histórico do projeto) ao definir o `schema.prisma`.

### Nota Fiscal (`GET /nota-fiscal`)

- **Sem cursor de "alterado desde"** — só `DataEmissaoInicial`/`DataEmissaoFinal` (data de emissão, não de alteração). **Decisão do projeto**: como não existe filtro de alteração, a sincronização roda uma vez por dia (madrugada) reprocessando os **últimos 60 dias** via `DataEmissaoInicial`/`Final`, em vez de tentar sincronizar só "o que é novo" — isso captura cancelamentos e outras alterações pós-emissão dentro dessa janela. Upsert por `id_externo_erp` garante que reprocessar o mesmo período não duplica registros. Não é uma sincronização incremental no sentido dos outros recursos — é um refresh periódico de uma janela fixa.
- Outros filtros: `NumeroInicial`/`Final`, `Tipos` (`Entrada`/`Saida`), `CodigoPedido`, `ChaveAcessoNfe`/`ChaveAcessoNfse`, `IdClientesFornecedores`.
- Campos-chave: `id` (→ `id_externo_erp`), `codigoIntegrador`, `chave` (chave de acesso da NF-e, provável chave natural útil para idempotência/upsert adicional), `pedidos[].id` (referência ao `pedido`), `nfe.status`/`nfse` (status fiscal).

### Cliente (`GET /cliente`)

- **Cursor de incremental**: `DataHoraGravacaoInicial`/`DataHoraGravacaoFinal` (par de datas, não um cursor único como o de pedido — a strategy precisa calcular a janela a cada execução, ex: `[últimaSincronizacao, agora]`).
- Outros filtros: `Situacao` (`Ativo`/`Inativo`/`Todos`), `TipoPessoa` (`Fisica`/`Juridica`/`Todos`), `CpfCnpj`, `RazaoSocial`, `NomeFantasia`, `UF`, `IdVendedor`/`IdRepresentante`.
- Campos-chave: `id` (→ `id_externo_erp`), `codigoIntegrador`, `cpfCnpj`, `razaoSocial`/`nomeFantasia`, `inativo`, `enderecos[]`, `contatos[]` (cada contato também tem seu próprio `codigoIntegrador` — decidir se contatos viram registros próprios no nosso banco ou ficam embutidos no cliente).
- A API também expõe `POST` (gravação) e `PATCH` (alteração parcial) para cliente — hoje fora de escopo (só leitura), mas relevante registrar caso o projeto decida escrever de volta no futuro; nesse caso, seguiria como fluxo separado, nunca misturado ao pipeline de leitura (ver convenção de "Direção do fluxo" na skill `nestjs`).

### Produto (`GET /produto`)

- **Cursor de incremental**: `DataHoraAlteracao` (`date-time`, parâmetro único — mesmo padrão de `pedido`, não range como `cliente`). Sync incremental direto: "buscar tudo alterado a partir de X".
- Outros filtros: `Tipo` (array enum: `Proprios`, `Terceiros`, `Kits`, `Embalagens` — decidir se sincronizamos os quatro tipos ou só um subconjunto), `Situacao` (`Ativo`/`Inativo`/`Todos`), `Codigo`, `Nome`, `Descricao`, `GTIN` (código de barras), `Referencia`/`ReferenciaGrade`, `Classificacao`, `DesconsiderarCaracteristicaRWWS` (boolean — significado não confirmado, não usar sem entender o efeito).
- `Ids`, `CodigosIntegrador`, `Fields` seguem o padrão comum a todos os recursos.
- **Sistema de grade**: produto tem `idGrade1`/`idGrade2`/`idGrade3` (dimensões de variação, ex: cor/tamanho) e `referenciasGrade[]` (referência específica por combinação de grade). Isso é o que `itens[].produtoServico.idItemGrade1/2/3` em `pedido` referencia — ou seja, a referência de um item de pedido a um produto **não é só pelo `id` do produto**, é pela combinação `id` + até 3 níveis de grade. Ao desenhar a tabela de produtos sincronizados, considerar se a chave de upsert precisa incluir os níveis de grade ou se cada combinação de grade vira sua própria linha.
- Campos-chave da resposta: `id` (→ `id_externo_erp`), `codigoIntegrador`, `codigo`, `nome`, `descricao`, `tipo` (mesmo enum de `Tipo` do filtro), `inativo`, `precoVenda`, `complemento.gtin`/`gtinTributavel`, `kit[]` (se o produto for um kit, lista os itens componentes — relevante para conciliar com `pedido.kits[]`).
- Schema também traz blocos fiscais extensos (`ipi`, `aliquotasICMS`, `produtoPISCOFINS`, `informacoesFiscais`) e físicos (`dimensoes`, `embalagem`, `composicaoLocal` para produção) — mapear no Prisma só o que o sistema for efetivamente usar, seguindo o mesmo critério já aplicado a `pedido`/`nota-fiscal`.
- **`dimensoes.comprimento`/`dimensoes.unidadeMedidaComprimento`** (OS-BACKEND-24): comprimento por peça/unidade fechada, mapeado para `Produto.comprimentoMetros` **só quando** `unidadeMedidaComprimento` é `"Metro"` — valor exato desse enum ainda **não confirmado** contra o ambiente real (o swagger só mostra `"Invalido"` como placeholder de exemplo); qualquer valor diferente de `"Metro"` (incluindo ausente) fica `null`, fail-safe. Há também um campo `classificacao: string` (livre) no produto cuja relação com a regra de negócio POC/RET/KM (unidade de venda) **não foi confirmada** — ficou como pendência explícita, não usado ainda (ver `Produto.tipoVenda`, nullable, sem população automática).

### Vendedor (`GET /vendedor`)

- **Sem filtro de data** — diferente de todos os outros recursos desta lista: não há `DataHoraAlteracao` (cursor único, como produto/pedido) nem par `Inicial`/`Final` (como cliente/nota-fiscal). Filtros disponíveis: `Nome`, `Email`, `Codigo`, `Situacao` (`Todos`/`Inativo`/`Ativo`), `PercentualComissaoFaturamento/RecebimentoInicial/Final`, `PagamentoComissao` (`Todos`/`Semana`/`Mensal`), `ListaIDFilial`, além de `Ids`/`CodigosIntegrador`/`Fields` (padrão comum). **Decisão do projeto (OS-BACKEND-21)**: sem filtro de alteração, não há como sincronizar incrementalmente — a estratégia reprocessa a lista inteira a cada execução (`agendamento: 'JANELA_FIXA_DIARIA'`, uma vez por noite; volume tipicamente baixo o suficiente para não precisar de janela/paginação). Mesmo raciocínio de nota-fiscal, um degrau mais simples (nem sequer há um campo de data pra filtrar por).
- Campos-chave da resposta: `id` (→ `id_externo_erp`), `codigoIntegrador`, `codigo`, `nome`, `email`, `inativo`. Campos de comissão (`valorFixo`, `percentualComissaoFaturamento`/`Recebimento`, `pagamentoComissao*`) e telefone (`fone1`/`fone2`, `dddFone1`/`dddFone2`) existem na resposta mas ficam fora do escopo atual — só mapear se/quando o sistema precisar exibir isso.
- **Vínculo com usuário do sistema de autenticação**: não vem do WK Radar — é calculado no `upsert()` da strategy, por correspondência de `email` (case-insensitive) contra a tabela `Usuario` local. Como `Usuario` só existe após o primeiro login (`UsuariosService.obterOuCriarPorSub`), a maioria dos vendedores pode não ter correspondência na primeira sincronização — isso é esperado, não um erro: sinalizado via `Vendedor.semCorrespondenciaUsuario`, sem lançar exceção (não pode derrubar a sincronização dos demais vendedores, ver `SyncService.executar`). Reavaliado a cada full refresh noturno.

## Pendências (não implementar sem resolver antes)

- **`DesconsiderarCaracteristicaRWWS`** (filtro de produto) — significado não confirmado; não usar até entender o efeito no resultado da busca.
- **Chave de upsert de produto com grade** — decidir se a strategy de sync trata cada combinação de grade como registro próprio ou se agrupa por produto base (ver "Sistema de grade" acima) antes de desenhar o `schema.prisma`.
- **Tamanho de janela de paginação por recurso** — decidir o valor inicial (ex: 1 dia) por recurso durante a implementação, ajustando conforme o volume real observado (ver seção "Paginação" acima).
- **Origem da classificação POC/RET/KM (unidade de venda de produto, OS-BACKEND-24)** — não confirmado se o campo `classificacao` (string livre) do produto já carrega essa informação, ou se precisa ser calculada a partir de `dimensoes.comprimento`; a faixa exata de corte entre as três categorias (incluindo o que acontece entre 30m e 50m — é `RET`, uma quarta faixa, ou essa faixa não existe como produto?) também não foi validada com quem define a regra de negócio. `Produto.tipoVenda` existe no schema (nullable) mas fica sem população automática até isso ser resolvido.
- **Valor exato do enum `unidadeMedidaComprimento`** (bloco `dimensoes` de produto) — swagger só mostra `"Invalido"` como placeholder; `ProdutoSyncStrategy` assume `"Metro"` como o valor que significa metros (ver `produto.sync.ts:UNIDADE_MEDIDA_METRO`), não confirmado contra o ambiente real.
