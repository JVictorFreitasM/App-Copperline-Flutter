# Graph Report - App Copperline  (2026-09-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 5363 nodes · 11994 edges · 236 communities (219 shown, 17 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 337 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e5ffc43c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 173
- Community 174
- Community 175
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 182
- Community 183
- Community 184
- Community 185
- Community 186
- Community 187
- Community 188
- Community 189
- Community 190
- Community 191
- Community 192
- Community 193
- Community 194
- Community 195
- Community 196
- Community 197
- Community 198
- Community 199
- Community 200
- Community 201
- Community 202
- Community 203
- Community 204
- Community 205
- Community 206
- Community 207
- Community 208
- Community 209
- Community 210
- Community 211
- Community 212
- Community 213
- Community 214
- Community 215
- Community 216
- Community 217
- Community 218
- Community 219
- Community 220
- Community 221
- Community 222
- Community 223
- Community 224
- Community 225
- Community 226
- Community 227
- Community 228
- Community 229
- Community 230
- Community 231
- Community 235

## God Nodes (most connected - your core abstractions)
1. `@nestjs/common` - 224 edges
2. `PrismaService` - 152 edges
3. `exigirUsuarioAutenticado()` - 78 edges
4. `apiFetch()` - 75 edges
5. `EscopoClientes` - 69 edges
6. `class-validator` - 68 edges
7. `@copperline/idp-client` - 63 edges
8. `next` - 62 edges
9. `react` - 61 edges
10. `ApiError` - 58 edges

## Surprising Connections (you probably didn't know these)
- `criarService()` --calls--> `CriarPedidoService`  [EXTRACTED]
  backend/src/pedidos/criar-pedido.service.spec.ts → backend/src/pedidos/criar-pedido.service.ts
- `ItemTexto()` --calls--> `formatarDataHora()`  [EXTRACTED]
  frontend/src/components/design/timeline.tsx → frontend/src/lib/formatacao.ts
- `Win32Window::Win32Window()` --calls--> `Destroy`  [INFERRED]
  mobile/windows/runner/win32_window.cpp → mobile/windows/runner/win32_window.h
- `wWinMain()` --calls--> `CreateAndAttachConsole()`  [INFERRED]
  mobile/windows/runner/main.cpp → mobile/windows/runner/utils.cpp
- `ImportarSwaggerPage()` --calls--> `exigirUsuarioAutenticado()`  [EXTRACTED]
  frontend/src/app/admin/importar-swagger/page.tsx → frontend/src/lib/auth.ts

## Import Cycles
- None detected.

## Communities (236 total, 17 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (130): app_card.dart, aprovacoes_screen.dart, ../core/formatacao.dart, ../core/models/indicadores_home.dart, ../core/models/pedido.dart, ../core/models/timeline_evento.dart, ../core/providers/dashboard_provider.dart, ../core/providers/indicadores_home_provider.dart (+122 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (55): backend_generated_prisma_client, backend_generated_prisma_client_eventonotificacao, backend_generated_prisma_client_prisma, backend_generated_prisma_client_prismaclient, test, ClienteEstatisticasService, decimalFake(), ESCOPO_TODOS (+47 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (93): AdminCoberturasPage(), AprovacoesPage(), BuscaPage(), CoberturasPage(), NotasFiscaisPage(), PainelPage(), calcularPesoItem(), ConteudoPedido() (+85 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (63): AdminAgendamentosPage(), AdminPagamentoPage(), ordenarPorIdade(), QualidadeDadosPage(), ROTA_DETALHE, ROTULO_TIPO, TipoRegistroIncompleto, AdminTiposAcondicionamentoPage() (+55 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (50): AdminSyncModule, Module, AppModule, Module, RequireSessionMiddleware, Injectable, ConfiguracoesModule, Inject (+42 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (45): ComparativoVendedoresService, Injectable, ComparativoVendedorDto, AdminGamificacaoController, AdminMetasController, Body, Controller, Get (+37 more)

### Community 6 - "Community 6"
Cohesion: 0.03
Nodes (86): api_client.dart, ClienteLocalizacaoService, clientes_provider.dart, CriarPedidoService, ../local_db/offline_fallback.dart, filtrados, inicio, itensDaPagina (+78 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (51): atualizarAtivoCondicaoPagamento(), atualizarAtivoFormaPagamento(), PagamentoAtivoToggle(), FotoVisita(), criarAgendamento(), EstadoCriarAgendamento, CriarAgendamentoForm(), onMudarQuery() (+43 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (46): backend_generated_prisma_client_statuspedidolocal, DashboardController, Controller, CurrentUser, Get, Query, chaveAnoMes(), DashboardService (+38 more)

### Community 9 - "Community 9"
Cohesion: 0.03
Nodes (69): ../core/models/produto.dart, ../core/providers/pagamento_provider.dart, ../core/providers/produtos_provider.dart, double get, estoque_screen.dart, ProdutoDetalhe, ProdutoResumo, apiClient (+61 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (50): RelatorioPedidosPage(), ClienteDetalhePage(), OPCOES_MESES, IconeAlerta(), IconeAtualizar(), IconeBusca(), IconeCaixa(), IconeCalendario() (+42 more)

### Community 11 - "Community 11"
Cohesion: 0.04
Nodes (56): ../core/auth/auth_notifier.dart, ../core/models/horario_trabalho.dart, ../core/providers/horario_trabalho_provider.dart, ../core/providers/offline_provider.dart, ../core/push/push_service.dart, ../core/rastreio/rastreio_config.dart, ../core/rastreio/rastreio_service.dart, ../core/sync/background_sync.dart (+48 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (44): aprovarSolicitacao(), decidir(), EstadoDecisao, rejeitarSolicitacao(), AprovarRejeitarForm(), ESTADO_INICIAL, atualizarPrecoFabricacao(), atualizarTipoAcondicionamento() (+36 more)

### Community 13 - "Community 13"
Cohesion: 0.05
Nodes (36): backend_generated_prisma_client_documento, backend_generated_prisma_client_usuario, AdminDocumentosController, Body, Controller, CurrentUser, Delete, HttpCode (+28 more)

### Community 14 - "Community 14"
Cohesion: 0.05
Nodes (43): backend_generated_prisma_client_statusnfe, backend_generated_prisma_client_tiponotafiscal, TIPOS_CADENCIA, FiltroClientes, PaginationQueryDto, IsInt, IsOptional, Max (+35 more)

### Community 15 - "Community 15"
Cohesion: 0.05
Nodes (53): cliente_detalhe_screen.dart, ConsumerWidget, ../core/models/cliente.dart, ../core/models/visita.dart, ../core/providers/busca_provider.dart, ../core/providers/favoritos_provider.dart, ../core/providers/roteiro_provider.dart, MaterialPageRoute (+45 more)

### Community 16 - "Community 16"
Cohesion: 0.07
Nodes (25): BoletoArquivoDto, ClienteBoletoService, ESCOPO_TODOS, Injectable, ClienteFinanceiroDto, ClienteFinanceiroService, paraDto(), ESCOPO_TODOS (+17 more)

### Community 17 - "Community 17"
Cohesion: 0.08
Nodes (22): backend_generated_prisma_client_papelvendedor, CurrentUser, AtualizarConfiguracaoOrcamentoInput, ConfiguracaoOrcamentoDto, AtualizarHorarioTrabalhoDto, Matches, MobileController, Controller (+14 more)

### Community 18 - "Community 18"
Cohesion: 0.07
Nodes (33): backend_generated_prisma_client_tipoacondicionamento, AdminTiposAcondicionamentoController, Body, Controller, Get, Param, Patch, Post (+25 more)

### Community 19 - "Community 19"
Cohesion: 0.07
Nodes (26): ClienteResumoSchema, Inject, ESCOPO_TODOS, VisitaResumoSchema, ClienteResumoHandoffDto, ResumoSchema, calcularVariacaoAnoAnterior(), gerarSerieMensal() (+18 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (38): AbaAlcadaAprovacao(), salvar(), AbaLlm(), alternarFallback(), salvar(), AbaOrcamento(), salvar(), AbaRastreio() (+30 more)

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (16): CriarPedidoResultadoDto, PedidoDetalheDto, PedidosController, Body, Controller, CurrentUser, Delete, Get (+8 more)

### Community 22 - "Community 22"
Cohesion: 0.05
Nodes (45): FilaPendenteService, ../local_db/acao_pendente.dart, ../local_db/snapshot_service.dart, EstoqueNotifier, acoesPendentesPorTipoProvider, _aoMudarConectividade, apiClient, _assinatura (+37 more)

### Community 23 - "Community 23"
Cohesion: 0.06
Nodes (43): ConsumerState, ConsumerStatefulWidget, ../../core/documentos/documento_download_service.dart, ../../core/models/documento.dart, ../core/models/tabela_preco.dart, ../../core/providers/documentos_provider.dart, ../core/providers/tabelas_preco_provider.dart, documentoDownloadServiceProvider (+35 more)

### Community 24 - "Community 24"
Cohesion: 0.05
Nodes (43): AgendamentosVisitaService, ../core/local_db/acao_pendente.dart, ../core/localizacao_atual.dart, ../core/models/cliente_resumo_llm.dart, ../core/models/configuracao_rastreio.dart, ../core/providers/agendamentos_visita_provider.dart, ../core/providers/cliente_resumo_llm_provider.dart, agendamentosPorClienteProvider (+35 more)

### Community 25 - "Community 25"
Cohesion: 0.08
Nodes (24): backend_generated_prisma_client_condicaopagamento, backend_generated_prisma_client_formapagamento, AdminPagamentoController, Body, Controller, Get, Param, Patch (+16 more)

### Community 26 - "Community 26"
Cohesion: 0.07
Nodes (23): AdminEndpointsModule, Module, ErpClientModule, Module, EstoqueConsultaDto, EstoqueItemDto, EstoqueService, configServiceFake() (+15 more)

### Community 27 - "Community 27"
Cohesion: 0.06
Nodes (40): api_exception.dart, ../core/models/estoque.dart, ../core/providers/estoque_provider.dart, ResultadoEstoque, apiClient, build, EstoqueCarregando, EstoqueComSaldo (+32 more)

### Community 28 - "Community 28"
Cohesion: 0.06
Nodes (38): ../core/api_exception.dart, ../core/providers/aprovacoes_provider.dart, ../core/providers/pedidos_provider.dart, ../core/push/push_config.dart, fromJson, MeuVendedor, papel, podeAprovar (+30 more)

### Community 29 - "Community 29"
Cohesion: 0.07
Nodes (27): backend_generated_prisma_client_agendamentovisita, AgendamentosVisitaController, Body, Controller, CurrentUser, Get, Post, Query (+19 more)

### Community 30 - "Community 30"
Cohesion: 0.08
Nodes (18): buildBuscarTabelasPrecoBody(), LoginRadar, EmpresarialSvcClientService, JSON_FAULT, JSON_SUCESSO, Injectable, ItemTabelaPrecoBruto, TabelaPrecoBruta (+10 more)

### Community 31 - "Community 31"
Cohesion: 0.09
Nodes (28): backend_generated_prisma_client_contatocliente, ClienteEstatisticasDto, ClienteResumoLlmDto, TimelineEvento, ClientesService, ConflitoClienteDto, ESCOPO_TODOS, Injectable (+20 more)

### Community 32 - "Community 32"
Cohesion: 0.09
Nodes (21): buildBuscarSaldoProdutoBody(), EstoqueSvcClientModule, Module, EstoqueSvcClientService, JSON_FAULT, JSON_SUCESSO, Injectable, SaldoProdutoBruto (+13 more)

### Community 33 - "Community 33"
Cohesion: 0.05
Nodes (39): ../core/providers/clientes_provider.dart, FiltroClientes?, clientesProvider, ConflitoCliente, conflitoClienteServiceProvider, aoSelecionar, _aplicarBusca, build (+31 more)

### Community 34 - "Community 34"
Cohesion: 0.05
Nodes (37): author, description, license, name, private, version, compression, cross-env (+29 more)

### Community 35 - "Community 35"
Cohesion: 0.07
Nodes (22): AdminEndpointsController, Body, Controller, Post, UseGuards, ImportarSwaggerDto, IsString, Matches (+14 more)

### Community 36 - "Community 36"
Cohesion: 0.08
Nodes (22): AdminCoberturasController, Body, Controller, Get, Post, UseGuards, CoberturaResumoDto, CoberturaResumoService (+14 more)

### Community 37 - "Community 37"
Cohesion: 0.06
Nodes (36): acao_pendente.dart, dart:convert, Database, Database get, local_database.dart, _apiClient, contarPendentes, enfileirar (+28 more)

### Community 38 - "Community 38"
Cohesion: 0.06
Nodes (38): busca_screen.dart, clientes_screen.dart, documentos_screen.dart, ../home_screen.dart, authProvider, meuVendedorProvider, _RotuloPapel, _aba (+30 more)

### Community 39 - "Community 39"
Cohesion: 0.08
Nodes (12): SyncProcessor, Processor, SyncScheduler, Cron, Inject, Injectable, InjectQueue, FetchFn (+4 more)

### Community 40 - "Community 40"
Cohesion: 0.08
Nodes (28): backend_generated_prisma_client_notafiscal, backend_generated_prisma_client_notafiscalpedido, backend_generated_prisma_client_pedidoitem, backend_generated_prisma_client_produto, backend_generated_prisma_client_vendedor, ResumoDashboardDto, CurrentUser, Get (+20 more)

### Community 41 - "Community 41"
Cohesion: 0.07
Nodes (28): backend_generated_prisma_client_pedidohistoricostatus, backend_generated_prisma_client_tiposituacaopedido, AlterarVendedorOrcamentoDto, IsUUID, ListarPedidosQueryDto, SITUACOES_VALIDAS, STATUS_APROVACAO_VALIDOS, IsDateString (+20 more)

### Community 42 - "Community 42"
Cohesion: 0.13
Nodes (18): buscarPorJanelas(), contagemSuspeitaDeTruncamento(), CONTAGENS_SUSPEITAS, gerarSubJanelas(), ResultadoBuscaPaginada, CAMPOS_CLIENTE, formatarDataWkRadar(), PrismaTx (+10 more)

### Community 43 - "Community 43"
Cohesion: 0.11
Nodes (21): backend_generated_prisma_client_synclogstatus, backend_generated_prisma_client_tipocadenciasync, EmpresarialSvcClientModule, Module, NOTIFICACAO_JOB_NAME, NOTIFICACAO_QUEUE, ConfiguracaoCadencia, construirCronPattern() (+13 more)

### Community 44 - "Community 44"
Cohesion: 0.09
Nodes (20): ListarNotasFiscaisQueryDto, IsIn, IsInt, IsOptional, IsString, Type, NotaFiscalDto, paraNotaFiscalDto() (+12 more)

### Community 45 - "Community 45"
Cohesion: 0.08
Nodes (22): AdminRastreioController, Controller, Get, Param, Query, UseGuards, ConsultarTrajetoDataQueryDto, Matches (+14 more)

### Community 46 - "Community 46"
Cohesion: 0.09
Nodes (22): backend_generated_prisma_client_tipoeventonotificacao, PrismaTx, registrarEventoNotificacao(), RegistrarEventoNotificacaoInput, resolverUsuariosAlvo(), INPUT_BASE, CAMPOS_NOTA_FISCAL, formatarDataWkRadarSemHora() (+14 more)

### Community 47 - "Community 47"
Cohesion: 0.11
Nodes (17): AdminSyncController, Controller, Get, Query, UseGuards, paginar(), PaginatedResult, NotificacaoDto (+9 more)

### Community 48 - "Community 48"
Cohesion: 0.06
Nodes (33): cliente, ClienteResumoPedido, codigo, ConfigSituacao, configSituacaoPedido, dataHoraUltimaAlteracao, enfase, fromJson (+25 more)

### Community 49 - "Community 49"
Cohesion: 0.09
Nodes (22): backend_generated_prisma_client_situacaoitempedido, CAMPOS_PEDIDO, formatarDataWkRadar(), IBGE_UF_POR_PREFIXO, MAPA_SITUACAO, MAPA_SITUACAO_ITEM, parseDataBrWkRadar(), PedidoSyncStrategy (+14 more)

### Community 50 - "Community 50"
Cohesion: 0.09
Nodes (20): RATE_LIMIT_KEY, RateLimit(), RateLimitConfig, RateLimitGuard, Inject, Injectable, EstoqueMaisPedidosQueryDto, ProdutoMaisPedidoDto (+12 more)

### Community 51 - "Community 51"
Cohesion: 0.13
Nodes (28): AdminMetasPage(), atualizarCadencia(), EstadoSync, mensagemErro(), rodarAgora(), CadenciaForm(), ESTADO_INICIAL, LogsSincronizacaoPage() (+20 more)

### Community 52 - "Community 52"
Cohesion: 0.06
Nodes (28): @pragma, auth/session_storage.dart, ../local_db/fila_pendente_service.dart, ../local_db/local_database.dart, _apiClient, _categoriaHabilitada, inicializar, _mostrarBannerForeground (+20 more)

### Community 53 - "Community 53"
Cohesion: 0.09
Nodes (16): ApiKeyGuard, isApiKeyEqual(), Injectable, AtualizarChaveLlmInput, CriarChaveLlmInput, AtualizarConfiguracaoDescontoInput, ConfiguracaoDescontoDto, VendedorListaDto (+8 more)

### Community 54 - "Community 54"
Cohesion: 0.08
Nodes (27): file_selector_plugin, FlPluginRegistry, flutter_linux, flutter_secure_storage_linux_plugin, FlView, GApplication, gboolean, gchar (+19 more)

### Community 55 - "Community 55"
Cohesion: 0.08
Nodes (21): Body, HttpCode, Param, Patch, Post, AtualizarConfiguracaoSyncDto, ArrayMaxSize, IsArray (+13 more)

### Community 56 - "Community 56"
Cohesion: 0.12
Nodes (21): nextConfig, GET(), GET(), GET(), GET(), frontend_src_app_globals, geistMono, geistSans (+13 more)

### Community 57 - "Community 57"
Cohesion: 0.11
Nodes (14): parseDataHoraBr(), parseDecimalBr(), EstoqueLoteSyncStrategy, JANELA, Injectable, EstoqueLoteBrutoAgrupado, EstoqueLoteItemMapeado, EstoqueLoteMapeado (+6 more)

### Community 58 - "Community 58"
Cohesion: 0.14
Nodes (17): backend_generated_prisma_client_itemtabelapreco, backend_generated_prisma_client_tabelapreco, ListarTabelasPrecoQueryDto, IsBoolean, IsOptional, Transform, ItemTabelaPrecoDto, paraItemTabelaPrecoDto() (+9 more)

### Community 59 - "Community 59"
Cohesion: 0.09
Nodes (27): dart:async, idp_user.dart, logout_service.dart, apiClientProvider, autenticado, AuthNotifier, AuthState, build (+19 more)

### Community 60 - "Community 60"
Cohesion: 0.07
Nodes (27): DioExceptionType?, Exception, int?, ApiException, message, statusCode, toString, PermissaoLocalizacaoNegadaException (+19 more)

### Community 61 - "Community 61"
Cohesion: 0.07
Nodes (28): dependencies, axios, bullmq, class-transformer, class-validator, compression, @copperline/idp-client, exifr (+20 more)

### Community 62 - "Community 62"
Cohesion: 0.07
Nodes (28): devDependencies, cross-env, eslint, eslint-config-prettier, @eslint/eslintrc, @eslint/js, eslint-plugin-prettier, globals (+20 more)

### Community 63 - "Community 63"
Cohesion: 0.15
Nodes (11): ListarProdutosQueryDto, IsOptional, IsString, paraProdutoDetalheDto(), paraProdutoResumoDto(), ProdutoDetalheDto, ProdutoResumoDto, TAMANHO_MAXIMO_IMAGEM_BYTES (+3 more)

### Community 64 - "Community 64"
Cohesion: 0.09
Nodes (10): NotificacaoDispatchService, serializarDados(), Injectable, NotificacaoProcessor, Processor, MensagemPush, PushNotificationClientService, ResultadoEnvioPush (+2 more)

### Community 65 - "Community 65"
Cohesion: 0.10
Nodes (16): ProdutoPrecosQueryDto, IsOptional, IsString, RupturaPrevistaQueryDto, IsInt, IsOptional, Max, Min (+8 more)

### Community 66 - "Community 66"
Cohesion: 0.07
Nodes (27): HttpClientAdapter, _AdapterFake, _AdapterFake, chamadas, close, corpo, corpoBruto, dados (+19 more)

### Community 67 - "Community 67"
Cohesion: 0.21
Nodes (12): arredondarMoeda(), ClienteLocalizacaoDto, ClientesController, Body, Controller, CurrentUser, Get, Param (+4 more)

### Community 68 - "Community 68"
Cohesion: 0.09
Nodes (15): AdminConfiguracaoRastreioController, Body, Controller, Get, Patch, paraDto(), Body, Controller (+7 more)

### Community 69 - "Community 69"
Cohesion: 0.07
Nodes (26): ClienteEstatisticas, clienteId, ContatoCliente, contatos, cpfCnpj, email, fromJson, funcao (+18 more)

### Community 70 - "Community 70"
Cohesion: 0.14
Nodes (16): CompraProduto, detectarAniversarioRelacionamento(), detectarRecompraProxima(), detectarSemPedidoHaDias(), diferencaDias(), MotivoOportunidade, ContextoSchema, OportunidadeClienteDto (+8 more)

### Community 71 - "Community 71"
Cohesion: 0.10
Nodes (15): AdminClientesTabelasPrecoController, Body, Controller, Delete, HttpCode, Param, Post, ClienteTabelaPrecoService (+7 more)

### Community 72 - "Community 72"
Cohesion: 0.15
Nodes (19): criarCobertura(), EstadoCriarCobertura, CriarCoberturaForm(), ESTADO_INICIAL, atualizarHierarquia(), atualizarPermiteCheckinSemAgendamento(), EstadoHierarquia, ESTADO_INICIAL (+11 more)

### Community 73 - "Community 73"
Cohesion: 0.09
Nodes (20): eslint, @types/node, typescript, name, private, version, CENTRO_PADRAO, MapaCalorVendas (+12 more)

### Community 74 - "Community 74"
Cohesion: 0.08
Nodes (23): clientesAtivos, codigo, EstoqueCriticoDashboard, fromJson, limiar, nome, pedidosEmAberto, pedidosRecentes (+15 more)

### Community 75 - "Community 75"
Cohesion: 0.10
Nodes (22): AsyncNotifier, Map, details, HealthNotifier, healthProvider, HealthStatus, ok, recarregar (+14 more)

### Community 76 - "Community 76"
Cohesion: 0.12
Nodes (13): BuscaController, Controller, Get, Query, BuscaService, CLIENTE_FAKE, PEDIDO_FAKE, PRODUTO_FAKE (+5 more)

### Community 77 - "Community 77"
Cohesion: 0.12
Nodes (12): AdminTabelasPrecoController, Body, Controller, Get, Patch, ConfiguracaoTabelaPrecoDto, ConfiguracaoTabelaPrecoService, paraDto() (+4 more)

### Community 78 - "Community 78"
Cohesion: 0.10
Nodes (16): AdminVendedoresController, Body, Controller, Get, Param, Patch, UseGuards, AtualizarHierarquiaVendedorDto (+8 more)

### Community 79 - "Community 79"
Cohesion: 0.08
Nodes (24): _, accentGreen, accentGreenLight, accentOrange, accentOrangeLight, accentRed, accentRedLight, amber (+16 more)

### Community 80 - "Community 80"
Cohesion: 0.10
Nodes (22): aprovacoes_provider.dart, favoritos_provider.dart, apiClient, estoque, estoqueProdutoProvider, favoritos, fromJson, json (+14 more)

### Community 81 - "Community 81"
Cohesion: 0.13
Nodes (5): CachedToken, ErpClientService, ENV, Injectable, WkRadarTokenResponse

### Community 82 - "Community 82"
Cohesion: 0.11
Nodes (18): AcaoFilaDto, EnviarFilaPendenteDto, ResultadoAcaoFilaDto, TAMANHO_MAXIMO_FILA, TipoAcaoFila, TIPOS_ACAO_FILA, ArrayMaxSize, ArrayMinSize (+10 more)

### Community 83 - "Community 83"
Cohesion: 0.09
Nodes (21): auth/idp_user.dart, Dio, _atrasosRetry, baseUrl, delete, _dio, _erroTransitorio, getBytes (+13 more)

### Community 84 - "Community 84"
Cohesion: 0.16
Nodes (13): AprovadorCandidato, AutoaprovacaoNaoPermitidaError, ConfiguracaoAlcadaAprovacao, DescontoExcedeAlcadaMaximaError, NIVEL_PAPEL, NivelHierarquiaInsuficienteError, PapelVendedor, ResultadoAvaliacaoAlcada (+5 more)

### Community 85 - "Community 85"
Cohesion: 0.16
Nodes (15): CENTRO_PADRAO, iconePadrao, iconeVisita, MapaEquipe(), hojeIso(), MapaEquipe, PainelRastreioEquipe(), buscarDetalhesVendedor() (+7 more)

### Community 86 - "Community 86"
Cohesion: 0.21
Nodes (13): ListaNotasFiscaisDto, buscarContagemNaoLidas(), buscarNotificacoesRecentes(), marcarNotificacaoComoLida(), marcarTodasComoLidas(), MarcarTodasButton(), NotificacaoItem(), NotificacaoSino() (+5 more)

### Community 87 - "Community 87"
Cohesion: 0.12
Nodes (12): AdminConfiguracaoOrcamentoController, Body, Controller, Get, Patch, ConfiguracaoOrcamentoService, paraDto(), linhaPadrao() (+4 more)

### Community 88 - "Community 88"
Cohesion: 0.12
Nodes (8): FavoritosService, Injectable, Body, CurrentUser, Delete, HttpCode, Param, Post

### Community 89 - "Community 89"
Cohesion: 0.14
Nodes (11): NotificacaoUsuarioService, notificacaoBruta(), prismaFake(), Injectable, NotificacoesController, Controller, CurrentUser, Get (+3 more)

### Community 90 - "Community 90"
Cohesion: 0.10
Nodes (20): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+12 more)

### Community 91 - "Community 91"
Cohesion: 0.22
Nodes (8): backend_generated_prisma_client_visita, validarPayload(), paraVisitaDto(), paraVisitaEquipeDto(), VisitaDto, VisitaEquipeDto, Injectable, VisitasService

### Community 92 - "Community 92"
Cohesion: 0.16
Nodes (12): arredondarMoeda(), calcularQuantidadePedido(), QuantidadeNaoFechaEmUnidadeError, ResultadoCalculoQuantidade, UnidadeCalculo, arredondarMoeda(), OpcoesCalculo, ProdutoCalculoService (+4 more)

### Community 93 - "Community 93"
Cohesion: 0.11
Nodes (19): configurar_servidor_screen.dart, _aoReceberErro, _aoReceberErroHttp, createState, dispose, _erroCaptura, _erroCarregamento, _iniciarTimeoutTimer (+11 more)

### Community 94 - "Community 94"
Cohesion: 0.12
Nodes (19): criar_pedido_screen.dart, criarPedidoServiceProvider, pedidosProvider, _aplicarFiltro, build, _cancelar, _clienteNome, _clienteNomeController (+11 more)

### Community 95 - "Community 95"
Cohesion: 0.14
Nodes (20): FlutterViewController, RegisterPlugins(), FlutterWindow, flutter_controller_, OnCreate, OnDestroy, project_, DartProject (+12 more)

### Community 96 - "Community 96"
Cohesion: 0.10
Nodes (19): cancelada, canceladaEm, checkinEm, checkinLat, checkinLng, checkoutEm, checkoutLat, checkoutLng (+11 more)

### Community 97 - "Community 97"
Cohesion: 0.14
Nodes (17): backend_dist_generated_prisma_client, criarTrajeto(), criarUsuarioMock(), deslocar(), main(), PONTO_BASE, prisma, { PrismaClient } (+9 more)

### Community 98 - "Community 98"
Cohesion: 0.15
Nodes (7): ProdutoImagemStorageService, Injectable, ProdutoManualService, prismaFake(), produtoFake(), TIPOS_MIME_IMAGEM_PERMITIDOS, Injectable

### Community 99 - "Community 99"
Cohesion: 0.19
Nodes (11): Body, Controller, CurrentUser, Get, Header, Param, Post, Query (+3 more)

### Community 100 - "Community 100"
Cohesion: 0.11
Nodes (17): DateTime, AgendamentoVisita, clienteId, criadoEm, dataHoraPrevista, fromJson, id, vendedorId (+9 more)

### Community 101 - "Community 101"
Cohesion: 0.16
Nodes (15): dwmapi, wchar_t, Scale(), Create, Destroy, SetQuitOnClose, Show, UpdateTheme (+7 more)

### Community 102 - "Community 102"
Cohesion: 0.18
Nodes (14): atualizarRankingVisivelParaVendedor(), definirMetaVendedor(), EstadoDefinirMeta, DefinirMetaForm(), ESTADO_INICIAL, RankingVisivelToggle(), MetasPage(), ConfiguracaoGamificacaoDto (+6 more)

### Community 103 - "Community 103"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 104 - "Community 104"
Cohesion: 0.11
Nodes (18): atualizadoEm, codigo, EstoqueItem, fabricadoEm, fromJson, itens, localCodigo, localNome (+10 more)

### Community 105 - "Community 105"
Cohesion: 0.17
Nodes (12): backend_generated_prisma_client_tipoproduto, CAMPOS_PRODUTO, formatarDataWkRadar(), MAPA_TIPO, ProdutoSyncStrategy, Injectable, ProdutoMapeado, TipoProdutoWkRadar (+4 more)

### Community 106 - "Community 106"
Cohesion: 0.14
Nodes (10): AdminConfiguracaoAlcadaAprovacaoController, Controller, Get, AdminConfiguracaoDescontoController, Controller, Get, UseGuards, ConfiguracaoDescontoService (+2 more)

### Community 107 - "Community 107"
Cohesion: 0.18
Nodes (10): AdminConfiguracaoLlmController, Body, Controller, Delete, Get, Param, Patch, Post (+2 more)

### Community 108 - "Community 108"
Cohesion: 0.12
Nodes (15): AdminProdutosController, Body, Controller, Param, Patch, Post, UploadedFile, UseInterceptors (+7 more)

### Community 109 - "Community 109"
Cohesion: 0.13
Nodes (11): ClienteSyncStrategy, MAPEADO_BASE, Injectable, ClienteMapeado, ContatoMapeado, WkRadarClienteDetalhes, WkRadarClienteInformacoesExtras2, WkRadarClienteInformacoesFinanceiras (+3 more)

### Community 110 - "Community 110"
Cohesion: 0.12
Nodes (17): ApiClient, ApiJsonClient, _ApiClientFake, _ApiClientPostFake, chamadas, getJson, lancarExcecao, main (+9 more)

### Community 111 - "Community 111"
Cohesion: 0.12
Nodes (16): codigo, CondicaoPagamento, descricao, FormaPagamento, fromJson, id, nome, titulo (+8 more)

### Community 112 - "Community 112"
Cohesion: 0.18
Nodes (9): HealthController, Controller, Get, HealthModule, Module, RedisHealthIndicator, Injectable, HealthCheck (+1 more)

### Community 113 - "Community 113"
Cohesion: 0.16
Nodes (14): adicionarDias(), arredondarMoeda(), arredondarPeso(), calcularParcelas(), calcularPesoTotal(), CriarPedidoInput, CriarPedidoItemInput, DadosProduto (+6 more)

### Community 114 - "Community 114"
Cohesion: 0.12
Nodes (8): CONDICAO_PAGAMENTO_PADRAO, CONTATO_PADRAO, criarService(), ESCOPO_TODOS, FORMA_PAGAMENTO_PADRAO, INPUT_BASE, PRODUTO_PADRAO, TABELA_PRECO_PADRAO

### Community 115 - "Community 115"
Cohesion: 0.19
Nodes (10): StatusSolicitacaoDesconto, avaliarComTratamento(), AvaliarDescontoInput, AvaliarDescontoResultado, paraDto(), paraResumoDto(), SolicitacaoDescontoDto, SolicitacaoDescontoResumoDto (+2 more)

### Community 116 - "Community 116"
Cohesion: 0.21
Nodes (12): mensagemErro(), removerDocumento(), uploadDocumento(), ESTADO_REMOCAO_INICIAL, ESTADO_UPLOAD_INICIAL, EstadoRemocao, EstadoUpload, DocumentosAdminPage() (+4 more)

### Community 117 - "Community 117"
Cohesion: 0.12
Nodes (16): ConfiguracaoRastreio, dentroDaJanela, desabilitarEdicaoHorarioTrabalhoAndroid, distanciaMaximaClienteRegistroPedidoMetros, distanciaMaximaClienteRegistroVisitaMetros, fromJson, habilitarRastreamentoDomingos, habilitarRastreamentoSabados (+8 more)

### Community 118 - "Community 118"
Cohesion: 0.12
Nodes (16): build, _estado, _estoqueCriticoFake, main, _meuVendedorFake, _resumoFake, _usuarioFake, package:copperline_mobile/core/auth/auth_notifier.dart (+8 more)

### Community 119 - "Community 119"
Cohesion: 0.15
Nodes (12): AtualizarChaveLlmDto, IsBoolean, IsOptional, IsString, MinLength, CriarChaveLlmDto, IsString, MinLength (+4 more)

### Community 120 - "Community 120"
Cohesion: 0.17
Nodes (16): CriarPedidoOfflineDto, CriarPedidoDto, CriarPedidoItemDto, ArrayMinSize, IsArray, IsBoolean, IsNumber, IsOptional (+8 more)

### Community 121 - "Community 121"
Cohesion: 0.12
Nodes (15): FlutterSecureStorage, _chaveCookie, _chaveUsuarioCache, _chaveValidadoEm, lerCookie, lerUsuarioCache, lerValidadoEm, limpar (+7 more)

### Community 122 - "Community 122"
Cohesion: 0.12
Nodes (14): List, clienteId, ClienteResumoLlm, dadosInsuficientes, fonteCache, fromJson, geradoEm, pontosDeAtencao (+6 more)

### Community 123 - "Community 123"
Cohesion: 0.12
Nodes (15): codigo, fromJson, gtin, id, idGrade1, idGrade2, idGrade3, inativo (+7 more)

### Community 124 - "Community 124"
Cohesion: 0.12
Nodes (15): cliente, ClienteResumoSolicitacao, criadoEm, fromJson, id, nome, pedido, PedidoResumoSolicitacao (+7 more)

### Community 125 - "Community 125"
Cohesion: 0.26
Nodes (3): criarItensPedido(), CriarPedidoService, Injectable

### Community 126 - "Community 126"
Cohesion: 0.15
Nodes (9): formatarDataIso(), PedidoErpClientService, PedidoErpCriarInput, PedidoErpCriarResultado, PedidoErpItemInput, PedidoErpParcelaInput, INPUT_BASE, Injectable (+1 more)

### Community 127 - "Community 127"
Cohesion: 0.14
Nodes (7): inicioDaSemana(), Inject, Injectable, VendedorVendasSemanaisService, IDP_USER, Injectable, VendedoresHierarquiaService

### Community 128 - "Community 128"
Cohesion: 0.23
Nodes (12): aprovarItem(), aprovarTodosItens(), decidir(), ESTADO_OK, EstadoDecisaoItem, rejeitarItem(), rejeitarTodosItens(), AprovarReprovarTudo() (+4 more)

### Community 129 - "Community 129"
Cohesion: 0.15
Nodes (14): AcaoPendente, deValor, erro, idLocal, payload, status, StatusAcaoPendente, StatusAcaoPendenteValor (+6 more)

### Community 130 - "Community 130"
Cohesion: 0.20
Nodes (9): clienteBruto(), decimalFake(), ESCOPO_TODOS, exifrMock, FOTO_BUFFER, IDP_USER, prismaFake(), visitaBruta() (+1 more)

### Community 131 - "Community 131"
Cohesion: 0.25
Nodes (9): atualizarAtivoTipoAcondicionamento(), atualizarTamanhoPadraoTipoAcondicionamento(), criarTipoAcondicionamento(), AtivoToggle(), CriarTipoForm(), ESTADO_CRIAR_TIPO_INICIAL, EstadoCriarTipo, TamanhoPadraoEditor() (+1 more)

### Community 132 - "Community 132"
Cohesion: 0.27
Nodes (10): associarTabelaPreco(), desassociarTabelaPreco(), gerarResumoVisitas(), ResultadoResumoVisitas, ResumoVisitas(), gerar(), TabelasPrecoCliente(), associar() (+2 more)

### Community 133 - "Community 133"
Cohesion: 0.21
Nodes (4): Controller, CurrentUser, Get, VendedoresController

### Community 134 - "Community 134"
Cohesion: 0.26
Nodes (8): ContextoAprovacaoDescontoDto, SolicitacoesDescontoController, Controller, CurrentUser, Get, HttpCode, Param, Post

### Community 135 - "Community 135"
Cohesion: 0.21
Nodes (6): ContextoAprovacaoDescontoService, decimalFake(), IDP_USER, IDP_USER_ADMIN, prismaFake(), Injectable

### Community 136 - "Community 136"
Cohesion: 0.15
Nodes (12): connectivity_plus, file_selector_macos, firebase_core, firebase_messaging, flutter_inappwebview_macos, flutter_secure_storage_darwin, Foundation, geolocator_apple (+4 more)

### Community 137 - "Community 137"
Cohesion: 0.15
Nodes (12): core/push/push_navigation.dart, core/server_config.dart, build, CopperlineApp, initializeApp, initializeDateFormatting, main, prefs (+4 more)

### Community 138 - "Community 138"
Cohesion: 0.19
Nodes (12): flutter_windows, _In_, _In_opt_, io, iostream, wWinMain(), string, wchar_t (+4 more)

### Community 139 - "Community 139"
Cohesion: 0.15
Nodes (12): ativa, codigo, codigoItem, dataUltimoReajuste, fromJson, id, ItemTabelaPreco, preco (+4 more)

### Community 140 - "Community 140"
Cohesion: 0.15
Nodes (12): data, fromJson, motivoCancelamento, notaFiscalNumero, notaFiscalStatus, pedidoNumero, situacao, statusAnterior (+4 more)

### Community 141 - "Community 141"
Cohesion: 0.15
Nodes (12): categoriaDoPayload, navigator, navigatorKey, null, pedidoId, produtoId, solicitacaoId, NavigatorState (+4 more)

### Community 142 - "Community 142"
Cohesion: 0.21
Nodes (9): backend_generated_prisma_client_cliente, backend_generated_prisma_client_pedido, backend_generated_prisma_client_solicitacaodesconto, calcularStatusAprovacao(), paraRelatorioPedidoItemDto(), RelatorioPedidoItemDto, RelatorioPedidosDto, RelatorioVendedorDto (+1 more)

### Community 143 - "Community 143"
Cohesion: 0.17
Nodes (12): scripts, build, format, lint, start, start:debug, start:dev, start:prod (+4 more)

### Community 144 - "Community 144"
Cohesion: 0.18
Nodes (3): ClienteResumoLlmService, ESCOPO_TODOS, Injectable

### Community 145 - "Community 145"
Cohesion: 0.21
Nodes (9): ComparativoMensalDashboardDto, ComparativoMensalMesDto, ComparativoMensalQueryDto, IsInt, IsOptional, IsUUID, Max, Min (+1 more)

### Community 147 - "Community 147"
Cohesion: 0.29
Nodes (5): CAMPOS_FORMA_PAGAMENTO, FormaPagamentoSyncStrategy, Injectable, FormaPagamentoMapeada, WkRadarFormaPagamento

### Community 148 - "Community 148"
Cohesion: 0.29
Nodes (5): CAMPOS_VENDEDOR, Injectable, VendedorSyncStrategy, VendedorMapeado, WkRadarVendedor

### Community 150 - "Community 150"
Cohesion: 0.17
Nodes (11): currency, data, formatarData, formatarDataHora, formatarMoeda, formatarPeso, formatarTamanhoArquivo, kb (+3 more)

### Community 151 - "Community 151"
Cohesion: 0.18
Nodes (11): build, _chaveServerUrl, definir, obterUrl, _prefs, salvarUrl, ServerConfigService, serverConfigServiceProvider (+3 more)

### Community 152 - "Community 152"
Cohesion: 0.18
Nodes (11): build, ConfigurarServidorScreen, _ConfigurarServidorScreenState, _controller, createState, dispose, _erro, permitirVoltar (+3 more)

### Community 153 - "Community 153"
Cohesion: 0.18
Nodes (11): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+3 more)

### Community 154 - "Community 154"
Cohesion: 0.24
Nodes (8): EstoqueCriticoDashboardDto, EstoqueCriticoQueryDto, LIMIAR_ESTOQUE_CRITICO_PADRAO, ProdutoEstoqueCriticoDto, IsInt, IsOptional, Min, Type

### Community 156 - "Community 156"
Cohesion: 0.18
Nodes (10): bool get, cliente.dart, BuscaResultado, clientes, fromJson, pedidos, produtos, vazio (+2 more)

### Community 157 - "Community 157"
Cohesion: 0.27
Nodes (7): dart_project, flutter_view_controller, functional, memory, string, vector, windows

### Community 158 - "Community 158"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/leaflet, @types/leaflet.heat, @types/node (+3 more)

### Community 159 - "Community 159"
Cohesion: 0.18
Nodes (10): generated_plugin_registrant, DartProject, HWND, LPARAM, LRESULT, UINT, WPARAM, FlutterWindow::FlutterWindow() (+2 more)

### Community 160 - "Community 160"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, prefer_related_applications, short_name (+2 more)

### Community 161 - "Community 161"
Cohesion: 0.24
Nodes (3): SegredoCryptoService, CHAVE_VALIDA, Injectable

### Community 162 - "Community 162"
Cohesion: 0.27
Nodes (7): ContagemPorSituacao, EtapaFunil, montarFunilPedidos(), SITUACOES_ATENDIMENTO_PARCIAL, SITUACOES_CONCLUIDO, SITUACOES_EM_PROCESSAMENTO, FunilPedidosDashboardDto

### Community 163 - "Community 163"
Cohesion: 0.27
Nodes (3): ConfiguracaoLlmService, paraDto(), Injectable

### Community 164 - "Community 164"
Cohesion: 0.20
Nodes (10): CheckinVisitaOfflineDto, CheckinVisitaDto, IsNumber, IsOptional, IsString, IsUUID, Max, Min (+2 more)

### Community 165 - "Community 165"
Cohesion: 0.22
Nodes (8): Body, CurrentUser, HttpCode, Post, RegistrarDispositivoDto, IsIn, IsNotEmpty, IsString

### Community 166 - "Community 166"
Cohesion: 0.20
Nodes (9): dart:io, _apiClient, arquivoEmCache, baixar, _diretorio, DocumentoDownloadService, _extensaoPorMime, _nomeArquivoLocal (+1 more)

### Community 167 - "Community 167"
Cohesion: 0.36
Nodes (6): importarSwagger(), ESTADO_INICIAL, EstadoImportacao, ImportarSwaggerResultado, ImportarSwaggerForm(), ImportarSwaggerPage()

### Community 168 - "Community 168"
Cohesion: 0.36
Nodes (10): HWND, LPARAM, LRESULT, UINT, WPARAM, EnableFullDpiSupportIfAvailable(), GetHandle, GetThisFromHandle (+2 more)

### Community 169 - "Community 169"
Cohesion: 0.22
Nodes (7): Body, Patch, AtualizarAlcadaAprovacaoDto, IsBoolean, IsNumber, Max, Min

### Community 170 - "Community 170"
Cohesion: 0.28
Nodes (6): AuthorizationExampleController, Controller, CurrentUser, Get, Post, UseGuards

### Community 171 - "Community 171"
Cohesion: 0.33
Nodes (6): criarPedidoServiceFake(), IDP_USER, montarService(), rastreioServiceFake(), vendedorEscopoServiceFake(), visitasServiceFake()

### Community 172 - "Community 172"
Cohesion: 0.22
Nodes (6): AdminVisitasController, Controller, Get, Header, Param, UseGuards

### Community 173 - "Community 173"
Cohesion: 0.22
Nodes (7): connectivity_plus_windows_plugin, file_selector_windows, firebase_core_plugin_c_api, flutter_inappwebview_windows_plugin_c_api, flutter_secure_storage_windows_plugin, geolocator_windows, plugin_registry

### Community 174 - "Community 174"
Cohesion: 0.22
Nodes (8): double?, fromJson, MetaProgresso, percentualAtingido, semanaInicio, SemanaVenda, valorMeta, valorVendido

### Community 175 - "Community 175"
Cohesion: 0.22
Nodes (9): dependencies, leaflet, leaflet.heat, next, react, react-dom, react-leaflet, recharts (+1 more)

### Community 176 - "Community 176"
Cohesion: 0.22
Nodes (8): email, fromJson, IdpUser, name, role, sub, system, toJson

### Community 177 - "Community 177"
Cohesion: 0.25
Nodes (6): Any, FlutterImplicitEngineBridge, FlutterImplicitEngineDelegate, AppDelegate, Bool, UIApplication

### Community 178 - "Community 178"
Cohesion: 0.25
Nodes (7): CalcularQuantidadeDto, IsNumber, IsOptional, IsPositive, IsString, Max, Min

### Community 179 - "Community 179"
Cohesion: 0.25
Nodes (6): Body, Patch, AtualizarConfiguracaoDescontoDto, IsNumber, Max, Min

### Community 180 - "Community 180"
Cohesion: 0.39
Nodes (5): decimalFake(), IDP_USER_FAKE, prismaComSolicitacaoPendente(), prismaFake(), solicitacaoFake()

### Community 181 - "Community 181"
Cohesion: 0.32
Nodes (5): Flutter, FlutterSceneDelegate, SceneDelegate, UIKit, XCTest

### Community 182 - "Community 182"
Cohesion: 0.29
Nodes (7): app_colors.dart, _, AppTheme, cardRadius, controlRadius, package:google_fonts/google_fonts.dart, static const double

### Community 183 - "Community 183"
Cohesion: 0.29
Nodes (6): ClienteEstatisticasQueryDto, IsInt, IsOptional, Max, Min, Type

### Community 184 - "Community 184"
Cohesion: 0.33
Nodes (4): decimalFake(), IDP_USER, IDP_USER_ADMIN, prismaFake()

### Community 185 - "Community 185"
Cohesion: 0.29
Nodes (7): AtualizarConfiguracaoRastreioDto, IsBoolean, IsInt, IsOptional, Matches, Min, Transform

### Community 186 - "Community 186"
Cohesion: 0.29
Nodes (4): ESCOPO_NENHUM, ESCOPO_PROPRIO, ESCOPO_TODOS, PEDIDO_DETALHE_BASE

### Community 187 - "Community 187"
Cohesion: 0.38
Nodes (3): Cocoa, FlutterMacOS, RunnerTests

### Community 188 - "Community 188"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 189 - "Community 189"
Cohesion: 0.33
Nodes (5): AtualizarConfiguracaoLlmDto, IsBoolean, IsOptional, IsString, MinLength

### Community 191 - "Community 191"
Cohesion: 0.33
Nodes (4): NotificacaoScheduler, Cron, Injectable, InjectQueue

### Community 192 - "Community 192"
Cohesion: 0.33
Nodes (6): ListarOportunidadesQueryDto, IsInt, IsOptional, Max, Min, Type

### Community 193 - "Community 193"
Cohesion: 0.47
Nodes (4): decimalFake(), IDP_USER, pedidoBruto(), prismaFake()

### Community 194 - "Community 194"
Cohesion: 0.33
Nodes (6): PontoRastreioDto, IsISO8601, IsNumber, IsOptional, Max, Min

### Community 195 - "Community 195"
Cohesion: 0.67
Nodes (4): ExifDadosData, FotoDataHoraDivergenteError, FotoSemExifDataHoraError, validarExifDataHora()

### Community 196 - "Community 196"
Cohesion: 0.47
Nodes (4): FlutterAppDelegate, AppDelegate, Bool, NSApplication

### Community 197 - "Community 197"
Cohesion: 0.40
Nodes (4): AuthController, Controller, CurrentUser, Get

### Community 198 - "Community 198"
Cohesion: 0.40
Nodes (3): AuthModule, Inject, Module

### Community 199 - "Community 199"
Cohesion: 0.40
Nodes (3): BuscaModule, Inject, Module

### Community 200 - "Community 200"
Cohesion: 0.40
Nodes (3): ClientesModule, Inject, Module

### Community 201 - "Community 201"
Cohesion: 0.40
Nodes (4): DefinirLocalizacaoClienteDto, IsNumber, Max, Min

### Community 202 - "Community 202"
Cohesion: 0.40
Nodes (3): CoberturasModule, Inject, Module

### Community 203 - "Community 203"
Cohesion: 0.40
Nodes (3): DashboardModule, Inject, Module

### Community 205 - "Community 205"
Cohesion: 0.40
Nodes (3): DocumentosModule, Inject, Module

### Community 206 - "Community 206"
Cohesion: 0.40
Nodes (3): EstoqueModule, Inject, Module

### Community 207 - "Community 207"
Cohesion: 0.40
Nodes (3): AuthorizationExampleModule, Inject, Module

### Community 208 - "Community 208"
Cohesion: 0.40
Nodes (3): MetasModule, Inject, Module

### Community 209 - "Community 209"
Cohesion: 0.40
Nodes (3): MobileModule, Inject, Module

### Community 210 - "Community 210"
Cohesion: 0.40
Nodes (3): NotasFiscaisModule, Inject, Module

### Community 211 - "Community 211"
Cohesion: 0.40
Nodes (3): OportunidadesModule, Inject, Module

### Community 212 - "Community 212"
Cohesion: 0.40
Nodes (3): PagamentoModule, Inject, Module

### Community 213 - "Community 213"
Cohesion: 0.60
Nodes (4): decimalFake(), itemFake(), prismaFake(), tabelaFake()

### Community 214 - "Community 214"
Cohesion: 0.40
Nodes (3): TiposAcondicionamentoModule, Inject, Module

### Community 216 - "Community 216"
Cohesion: 0.40
Nodes (4): FlutterPluginRegistry, RegisterGeneratedPlugins(), MainFlutterWindow, NSWindow

### Community 217 - "Community 217"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, start

### Community 218 - "Community 218"
Cohesion: 0.40
Nodes (5): serverUrlProvider, initState, _salvar, _aoTerminarCarregamento, build

### Community 220 - "Community 220"
Cohesion: 1.00
Nodes (3): decimalFake(), linhaPadrao(), prismaFake()

### Community 222 - "Community 222"
Cohesion: 0.50
Nodes (3): ListarMinhasVisitasQueryDto, IsOptional, Matches

### Community 223 - "Community 223"
Cohesion: 0.50
Nodes (3): exclude, extends, ./tsconfig.json

### Community 224 - "Community 224"
Cohesion: 0.50
Nodes (3): eslintConfig, ref_eslint, eslint-config-next

### Community 225 - "Community 225"
Cohesion: 0.50
Nodes (3): Point, x, y

### Community 226 - "Community 226"
Cohesion: 0.50
Nodes (3): Size, height, width

## Knowledge Gaps
- **1405 isolated node(s):** `DefinirLocalizacaoInput`, `AtualizarConfiguracaoRastreioInput`, `AtualizarConfiguracaoLlmInput`, `ConfiguracaoRastreioParaMobileDto`, `PontoRastreioInput` (+1400 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2407 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@nestjs/common` connect `Community 17` to `Community 1`, `Community 130`, `Community 4`, `Community 5`, `Community 135`, `Community 8`, `Community 13`, `Community 16`, `Community 144`, `Community 18`, `Community 19`, `Community 147`, `Community 148`, `Community 25`, `Community 26`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 34`, `Community 35`, `Community 36`, `Community 39`, `Community 41`, `Community 42`, `Community 43`, `Community 44`, `Community 45`, `Community 46`, `Community 47`, `Community 49`, `Community 50`, `Community 180`, `Community 53`, `Community 184`, `Community 57`, `Community 186`, `Community 58`, `Community 190`, `Community 63`, `Community 64`, `Community 193`, `Community 65`, `Community 70`, `Community 71`, `Community 76`, `Community 77`, `Community 81`, `Community 213`, `Community 88`, `Community 89`, `Community 219`, `Community 92`, `Community 220`, `Community 98`, `Community 105`, `Community 112`, `Community 113`, `Community 114`, `Community 115`, `Community 119`, `Community 126`, `Community 127`?**
  _High betweenness centrality (0.207) - this node is a cross-community bridge._
- **Why does `next` connect `Community 56` to `Community 128`, `Community 2`, `Community 3`, `Community 131`, `Community 132`, `Community 102`, `Community 167`, `Community 7`, `Community 73`, `Community 10`, `Community 72`, `Community 12`, `Community 51`, `Community 116`, `Community 85`, `Community 86`, `Community 20`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `react` connect `Community 7` to `Community 128`, `Community 2`, `Community 131`, `Community 132`, `Community 3`, `Community 102`, `Community 167`, `Community 72`, `Community 73`, `Community 10`, `Community 12`, `Community 51`, `Community 116`, `Community 20`, `Community 86`, `Community 85`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `DefinirLocalizacaoInput`, `AtualizarConfiguracaoRastreioInput`, `AtualizarConfiguracaoLlmInput` to the rest of the system?**
  _1405 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.018221215404313994 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.036251105216622455 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.03341523341523341 - nodes in this community are weakly interconnected._