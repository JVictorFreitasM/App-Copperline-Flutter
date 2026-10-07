import '../widgets/lista_atualizavel.dart';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import '../core/api_exception.dart';
import '../core/local_db/acao_pendente.dart';
import '../core/localizacao_atual.dart';
import '../core/models/cliente.dart';
import '../core/models/cliente_resumo_llm.dart';
import '../core/models/visita.dart';
import '../core/providers/agendamentos_visita_provider.dart';
import '../core/providers/clientes_provider.dart';
import '../core/providers/cliente_resumo_llm_provider.dart';
import '../core/models/configuracao_rastreio.dart';
import '../core/providers/offline_provider.dart';
import '../core/providers/visitas_provider.dart';
import '../core/formatacao.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/cartao_cliente.dart';
import 'cliente_produtos_precos_screen.dart';
import '../widgets/list_item_tile.dart';
import '../widgets/listagem_feedback.dart';
import '../widgets/stat_card.dart';
import '../widgets/status_badge.dart';
import '../widgets/timeline.dart';
import 'cliente_form_screen.dart';

String _hojeIso() => DateTime.now().toIso8601String().substring(0, 10);

/// Detalhe do cliente (mobile, equivalente à OS-WEB-15) - mostra o que a
/// listagem não mostra: cartão de apresentação (identificação, contato e
/// endereço, ver `widgets/cartao_cliente.dart`) e contatos. Só leitura.
class ClienteDetalheScreen extends ConsumerWidget {
  const ClienteDetalheScreen({super.key, required this.id});

  final String id;

  Future<void> _editar(BuildContext context) async {
    final salvou = await Navigator.of(
      context,
    ).push<bool>(MaterialPageRoute(builder: (_) => ClienteFormScreen(clienteId: id)));
    if (salvou == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Alteração salva - será enviada ao ERP.')),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clienteAsync = ref.watch(clienteDetalheProvider(id));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cliente'),
        actions: [
          // Edição precisa do servidor (e do Radar na fila) - só com o cliente já
          // carregado, nunca no estado de erro/carregando.
          if (clienteAsync.hasValue)
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Editar cliente',
              onPressed: () => _editar(context),
            ),
        ],
      ),
      body: SafeArea(
        child: clienteAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (erro, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: erro is ApiException && erro.statusCode == 404
                ? EstadoVazio(mensagem: "Cliente '$id' não encontrado.")
                : ErroConexao(mensagem: '$erro'),
          ),
          data: (cliente) => ListaAtualizavel(
            aoAtualizar: () async {
              ref.invalidate(clienteDetalheProvider(id));
              ref.invalidate(clienteEstatisticasProvider(id));
              ref.invalidate(clienteTimelineProvider(id));
              ref.invalidate(agendamentosPorClienteProvider(id));
              try {
                await ref.read(clienteDetalheProvider(id).future);
              } catch (_) {}
            },
            padding: const EdgeInsets.all(18),
            children: [
              _StatusEnvioErp(cliente: cliente),
              CartaoCliente(cliente: cliente),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) =>
                        ClienteProdutosPrecosScreen(clienteId: cliente.id, titulo: cliente.titulo),
                  ),
                ),
                icon: const Icon(Icons.sell_outlined, size: 18),
                label: const Text('Produtos e preços do cliente'),
              ),
              const SizedBox(height: 16),
              _CardVisita(cliente: cliente),
              const SizedBox(height: 16),
              _CardAgendamento(cliente: cliente),
              const SizedBox(height: 16),
              _CardResumoLlm(clienteId: id),
              const SizedBox(height: 24),
              Text('Estatísticas', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              _CardEstatisticas(clienteId: id),
              const SizedBox(height: 24),
              Text('Linha do tempo', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              _CardTimeline(clienteId: id),
              const SizedBox(height: 24),
              Text('Contatos', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              if (cliente.contatos.isEmpty)
                const EstadoVazio(mensagem: 'Nenhum contato cadastrado.')
              else
                for (final contato in cliente.contatos) ...[
                  ListItemTile(
                    titulo: contato.nome ?? '—',
                    subtitulo: contato.funcao ?? 'Sem função registrada',
                    valor: contato.email ?? contato.telefoneFormatado,
                  ),
                  const SizedBox(height: 8),
                ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Situação do envio ao WK Radar: cadastro feito pelo app que ainda não foi
/// aceito (PENDENTE) ou foi recusado (ERRO), e edição ainda não aplicada. Some
/// quando está tudo no Radar.
class _StatusEnvioErp extends StatelessWidget {
  const _StatusEnvioErp({required this.cliente});

  final ClienteDetalhe cliente;

  @override
  Widget build(BuildContext context) {
    final alteracao = cliente.alteracaoErp;
    if (!cliente.envioPendente && !cliente.envioComErro && alteracao == null) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                if (cliente.envioPendente)
                  const StatusBadge(texto: 'Cadastro pendente de envio ao ERP', tom: Tom.pendente),
                if (cliente.envioComErro)
                  const StatusBadge(texto: 'Erro no envio ao ERP', tom: Tom.atencao),
                if (alteracao != null)
                  StatusBadge(
                    texto: alteracao.comErro
                        ? 'Erro ao enviar alteração ao ERP'
                        : 'Alteração pendente de envio ao ERP',
                    tom: alteracao.comErro ? Tom.atencao : Tom.pendente,
                  ),
              ],
            ),
            if (cliente.envioComErro && cliente.erroEnvioErp != null) ...[
              const SizedBox(height: 8),
              Text(
                'O ERP recusou o cadastro: ${cliente.erroEnvioErp}. Corrija em "Editar cliente" - ao salvar, '
                'o cadastro é enviado de novo.',
                style: const TextStyle(fontSize: 12, color: AppColors.muted),
              ),
            ],
            if (alteracao != null && alteracao.comErro && alteracao.erro != null) ...[
              const SizedBox(height: 8),
              Text(
                'O ERP recusou a última alteração: ${alteracao.erro}',
                style: const TextStyle(fontSize: 12, color: AppColors.muted),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Card de resumo de carteira via IA (OS-MOBILE-18) - próprio provider
/// (não o do resto do detalhe do cliente), pra um erro/demora do LLM não
/// travar o resto da tela (que já carregou com sucesso).
class _CardResumoLlm extends ConsumerWidget {
  const _CardResumoLlm({required this.clienteId});

  final String clienteId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resumo = ref.watch(clienteResumoLlmProvider(clienteId));

    return resumo.when(
      loading: () => const AppCard(
        child: Row(
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
            ),
            SizedBox(width: 12),
            Text('Gerando resumo com IA...', style: TextStyle(color: AppColors.muted)),
          ],
        ),
      ),
      error: (erro, _) => AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Resumo indisponível',
              style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink),
            ),
            const SizedBox(height: 4),
            Text('$erro', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => ref.invalidate(clienteResumoLlmProvider(clienteId)),
              child: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
      data: (dados) => _CardResumoLlmDados(dados: dados),
    );
  }
}

class _CardResumoLlmDados extends StatelessWidget {
  const _CardResumoLlmDados({required this.dados});

  final ClienteResumoLlm dados;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome, size: 16, color: AppColors.primary),
              const SizedBox(width: 6),
              const Text(
                'Resumo do cliente',
                style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink),
              ),
              if (dados.dadosInsuficientes) ...[
                const SizedBox(width: 8),
                const AppBadge(texto: 'Dados insuficientes'),
              ],
            ],
          ),
          const SizedBox(height: 10),
          if (dados.pontosDeAtencao.isNotEmpty) ...[
            const Text(
              'Pontos de atenção',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted),
            ),
            const SizedBox(height: 4),
            for (final ponto in dados.pontosDeAtencao)
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text('•  $ponto', style: const TextStyle(color: AppColors.ink)),
              ),
            const SizedBox(height: 10),
          ],
          const Text(
            'Sugestão de abordagem',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted),
          ),
          const SizedBox(height: 4),
          Text(dados.sugestaoAbordagem, style: const TextStyle(color: AppColors.ink)),
        ],
      ),
    );
  }
}

/// Estatísticas de carteira (OS-MOBILE-25, GET /clientes/:id/estatisticas) -
/// mesmos 4 números do web (`frontend/src/app/clientes/[id]/page.tsx`),
/// via StatCard (grid 2x2, ver skill `design-system`).
class _CardEstatisticas extends ConsumerWidget {
  const _CardEstatisticas({required this.clienteId});

  final String clienteId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final estatisticas = ref.watch(clienteEstatisticasProvider(clienteId));

    return estatisticas.when(
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error: (erro, _) => ErroConexao(
        mensagem: '$erro',
        aoTentarNovamente: () => ref.invalidate(clienteEstatisticasProvider(clienteId)),
      ),
      data: (dados) => GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        // 1.6 estourava 5px na vertical em telas estreitas (valor/label
        // quebrando linha) - mais alto que largo o suficiente pro conteúdo.
        childAspectRatio: 1.35,
        children: [
          StatCard(
            icone: Icons.calendar_month_outlined,
            label: 'Total (últimos ${dados.meses} meses)',
            valor: formatarMoeda('${dados.totalUltimosMeses}'),
          ),
          StatCard(
            icone: Icons.receipt_long_outlined,
            label: 'Total geral (${dados.quantidadePedidos} pedido(s))',
            valor: formatarMoeda('${dados.totalGeral}'),
          ),
          StatCard(
            icone: Icons.trending_up_outlined,
            label: 'Ticket médio',
            valor: formatarMoeda('${dados.ticketMedio}'),
          ),
          StatCard(
            icone: Icons.person_outline,
            label: 'Vendedor responsável',
            valor: dados.vendedorResponsavel ?? '—',
          ),
        ],
      ),
    );
  }
}

/// Linha do tempo unificada DESTE cliente (OS-MOBILE-40, GET
/// /clientes/:id/timeline) - substitui o antigo histórico de visitas
/// isolado (evita duplicar o mesmo dado de visita em duas seções da tela,
/// mesmo critério já aplicado no web) - combina pedido/status/visita/nota
/// fiscal numa única lista cronológica (ver widgets/timeline.dart).
class _CardTimeline extends ConsumerWidget {
  const _CardTimeline({required this.clienteId});

  final String clienteId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timeline = ref.watch(clienteTimelineProvider(clienteId));

    return timeline.when(
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error: (erro, _) => ErroConexao(
        mensagem: '$erro',
        aoTentarNovamente: () => ref.invalidate(clienteTimelineProvider(clienteId)),
      ),
      data: (eventos) => eventos.isEmpty
          ? const EstadoVazio(mensagem: 'Nenhum evento registrado para este cliente.')
          : AppCard(child: Timeline(eventos: eventos)),
    );
  }
}

/// Check-in/checkout/cancelamento de visita (OS-MOBILE-21) - o backend
/// (VisitasService) é quem valida raio de 50m e EXIF da foto de verdade;
/// aqui a distância é checada ANTES de abrir a câmera só pra dar feedback
/// imediato sem gastar uma foto à toa. `minhasVisitasProvider` (mesmo
/// provider da OS-MOBILE-17/roteiro_screen.dart) já traz a agenda de hoje -
/// reaproveitada aqui pra saber se já existe uma visita em aberto (aqui ou
/// em outro cliente), sem precisar de um endpoint dedicado.
class _CardVisita extends ConsumerStatefulWidget {
  const _CardVisita({required this.cliente});

  final ClienteDetalhe cliente;

  @override
  ConsumerState<_CardVisita> createState() => _CardVisitaState();
}

class _CardVisitaState extends ConsumerState<_CardVisita> {
  bool _processando = false;

  @override
  Widget build(BuildContext context) {
    final visitasHoje = ref.watch(minhasVisitasProvider(_hojeIso()));
    final checkinsPendentes = ref.watch(acoesPendentesPorTipoProvider(TipoAcaoFila.checkinVisita));

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Visita',
            style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink),
          ),
          const SizedBox(height: 10),
          visitasHoje.when(
            loading: () => const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
            ),
            error: (erro, _) => Text(
              'Não foi possível verificar visitas de hoje: $erro',
              style: const TextStyle(fontSize: 12, color: AppColors.muted),
            ),
            data: (visitas) => _conteudo(context, visitas, checkinsPendentes.value ?? const []),
          ),
        ],
      ),
    );
  }

  // checkinPendenteAqui: check-in feito OFFLINE pra este cliente, ainda na
  // fila local (OS-MOBILE-XX, "indicador visual de status de
  // sincronização") - sem essa checagem, minhasVisitasProvider (dado do
  // SERVIDOR) não sabe desse check-in ainda, e a tela voltaria a mostrar o
  // botão "Fazer check-in" como se nada tivesse acontecido, arriscando um
  // check-in duplicado enquanto o primeiro ainda não sincronizou.
  Widget _conteudo(
    BuildContext context,
    List<Visita> visitasHoje,
    List<AcaoPendente> checkinsPendentes,
  ) {
    final checkinPendenteAqui = checkinsPendentes
        .where((a) => a.payload['clienteId'] == widget.cliente.id)
        .firstOrNull;

    if (checkinPendenteAqui != null) {
      final comErro = checkinPendenteAqui.status == StatusAcaoPendente.erro;
      return Row(
        children: [
          Icon(
            comErro ? Icons.error_outline : Icons.cloud_upload_outlined,
            size: 16,
            color: AppColors.muted,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              comErro
                  ? 'Falha ao sincronizar o check-in - será tentado novamente automaticamente.'
                  : 'Check-in salvo - aguardando conexão para sincronizar com o servidor.',
              style: const TextStyle(fontSize: 12, color: AppColors.muted),
            ),
          ),
        ],
      );
    }

    if (!widget.cliente.temLocalizacao) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Cliente sem localização (pin) definida - defina estando no local pra '
            'poder fazer check-in depois.',
            style: TextStyle(fontSize: 12, color: AppColors.muted),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: _processando ? null : () => _definirLocalizacao(context),
            icon: const Icon(Icons.pin_drop_outlined, size: 18),
            label: const Text('Definir localização aqui'),
          ),
        ],
      );
    }

    Visita? visitaAqui;
    Visita? visitaEmOutro;
    for (final visita in visitasHoje) {
      if (!visita.emAndamento) continue;
      if (visita.clienteId == widget.cliente.id) {
        visitaAqui = visita;
      } else {
        visitaEmOutro = visita;
      }
    }

    if (visitaAqui != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppBadge(texto: 'Em andamento'),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _processando ? null : () => _cancelarVisita(context, visitaAqui!),
                  child: const Text('Cancelar'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton(
                  onPressed: _processando ? null : () => _fazerCheckout(context, visitaAqui!),
                  child: const Text('Fazer checkout'),
                ),
              ),
            ],
          ),
        ],
      );
    }

    if (visitaEmOutro != null) {
      return const Text(
        'Você tem uma visita em aberto em outro cliente - finalize ou cancele antes '
        'de iniciar uma aqui.',
        style: TextStyle(fontSize: 12, color: AppColors.muted),
      );
    }

    return FilledButton.icon(
      onPressed: _processando ? null : () => _fazerCheckin(context),
      icon: const Icon(Icons.login, size: 18),
      label: const Text('Fazer check-in'),
    );
  }

  Future<void> _definirLocalizacao(BuildContext context) async {
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Definir localização'),
        content: const Text('Vai gravar a sua posição atual como o "pin" deste cliente. Confirma?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
    if (confirmado != true || !context.mounted) return;

    await _executar(context, () async {
      final posicao = await obterPosicaoAtual();
      await ref
          .read(clienteLocalizacaoServiceProvider)
          .definir(
            clienteId: widget.cliente.id,
            latitude: posicao.latitude,
            longitude: posicao.longitude,
          );
      ref.invalidate(clienteDetalheProvider(widget.cliente.id));
      return 'Localização definida.';
    });
  }

  Future<void> _fazerCheckin(BuildContext context) async {
    final config = await ref.read(configuracaoRastreioProvider.future);
    if (!context.mounted) return;
    final posicaoResultado = await _obterPosicaoOuBloquear(context, config);
    if (posicaoResultado.bloqueado || !context.mounted) return;
    final posicao = posicaoResultado.posicao;

    if (posicao != null) {
      final distancia = Geolocator.distanceBetween(
        widget.cliente.localizacaoLat!,
        widget.cliente.localizacaoLng!,
        posicao.latitude,
        posicao.longitude,
      );
      if (distancia > config.distanciaMaximaClienteRegistroVisitaMetros) {
        _mostrarSnackBar(
          context,
          'Você está a ${distancia.round()}m do cliente - fora do raio de '
          '${config.distanciaMaximaClienteRegistroVisitaMetros.round()}m para check-in.',
        );
        return;
      }
    }
    if (!context.mounted) return;

    // Só câmera nativa - ImageSource.camera nunca abre a galeria (requisito
    // explícito da OS: sem opção de escolher foto existente). SEM
    // imageQuality: com compressão, o image_picker recodifica o arquivo em
    // muitos Android e derruba o EXIF (inclusive DateTimeOriginal) - o
    // backend EXIGE esse metadado pra aceitar o check-in (anti-fraude, ver
    // validar-exif-foto.ts), então comprimir aqui quebra o check-in
    // inteiro com "Foto sem metadado de data/hora (EXIF)".
    final foto = await ImagePicker().pickImage(source: ImageSource.camera);
    if (foto == null || !context.mounted) return;

    final resultado = await _pedirNotaOpcional(
      context,
      titulo: 'Confirmar check-in',
      caminhoFoto: foto.path,
      textoConfirmar: 'Fazer check-in',
    );
    if (resultado == null || !context.mounted) return;
    final nota = resultado.nota;
    // caminhoFinal pode ter mudado se o usuário usou "Tirar novamente" no
    // diálogo - sempre não-nulo aqui porque passamos caminhoFoto acima.
    final caminhoFinal = resultado.caminhoFoto!;

    await _executar(
      context,
      () async {
        await ref
            .read(visitasAcoesServiceProvider)
            .checkin(
              clienteId: widget.cliente.id,
              latitude: posicao?.latitude,
              longitude: posicao?.longitude,
              caminhoFoto: caminhoFinal,
              nota: nota,
            );
        ref.invalidate(minhasVisitasProvider(_hojeIso()));
        return 'Check-in registrado.';
      },
      aoFalharPorRede: () async {
        final fotoBase64 = base64Encode(await File(caminhoFinal).readAsBytes());
        final fila = await ref.read(filaPendenteServiceProvider.future);
        await fila.enfileirar(
          tipo: TipoAcaoFila.checkinVisita,
          timestamp: DateTime.now(),
          payload: {
            'clienteId': widget.cliente.id,
            if (posicao != null) 'latitude': posicao.latitude,
            if (posicao != null) 'longitude': posicao.longitude,
            'foto': fotoBase64,
            if (nota.isNotEmpty) 'nota': nota,
          },
        );
        ref.invalidate(contagemPendentesProvider);
        ref.invalidate(acoesPendentesPorTipoProvider);
        return 'Sem conexão agora - check-in salvo e será enviado automaticamente '
            'quando a internet voltar.';
      },
    );
  }

  Future<void> _fazerCheckout(BuildContext context, Visita visita) async {
    final config = await ref.read(configuracaoRastreioProvider.future);
    if (!context.mounted) return;
    final posicaoResultado = await _obterPosicaoOuBloquear(context, config);
    if (posicaoResultado.bloqueado || !context.mounted) return;
    final posicao = posicaoResultado.posicao;

    if (posicao != null) {
      final distancia = Geolocator.distanceBetween(
        widget.cliente.localizacaoLat!,
        widget.cliente.localizacaoLng!,
        posicao.latitude,
        posicao.longitude,
      );
      if (distancia > config.distanciaMaximaClienteRegistroVisitaMetros) {
        _mostrarSnackBar(
          context,
          'Você está a ${distancia.round()}m do cliente - fora do raio de '
          '${config.distanciaMaximaClienteRegistroVisitaMetros.round()}m para checkout.',
        );
        return;
      }
    }
    if (!context.mounted) return;

    final resultado = await _pedirNotaOpcional(
      context,
      titulo: 'Confirmar checkout',
      textoConfirmar: 'Fazer checkout',
    );
    if (resultado == null || !context.mounted) return;
    final nota = resultado.nota;

    await _executar(
      context,
      () async {
        await ref
            .read(visitasAcoesServiceProvider)
            .checkout(
              visitaId: visita.id,
              latitude: posicao?.latitude,
              longitude: posicao?.longitude,
              nota: nota,
            );
        ref.invalidate(minhasVisitasProvider(_hojeIso()));
        return 'Checkout registrado.';
      },
      aoFalharPorRede: () async {
        final fila = await ref.read(filaPendenteServiceProvider.future);
        await fila.enfileirar(
          tipo: TipoAcaoFila.checkoutVisita,
          timestamp: DateTime.now(),
          payload: {
            'visitaId': visita.id,
            if (posicao != null) 'latitude': posicao.latitude,
            if (posicao != null) 'longitude': posicao.longitude,
            if (nota.isNotEmpty) 'nota': nota,
          },
        );
        ref.invalidate(contagemPendentesProvider);
        return 'Sem conexão agora - checkout salvo e será enviado automaticamente '
            'quando a internet voltar.';
      },
    );
  }

  Future<void> _cancelarVisita(BuildContext context, Visita visita) async {
    final comentario = await _pedirComentarioObrigatorio(
      context,
      titulo: 'Cancelar visita',
      explicacao: 'Obrigatório informar o motivo - seu supervisor será notificado.',
    );
    if (comentario == null || !context.mounted) return;

    await _executar(
      context,
      () async {
        await ref
            .read(visitasAcoesServiceProvider)
            .cancelar(visitaId: visita.id, comentario: comentario);
        ref.invalidate(minhasVisitasProvider(_hojeIso()));
        return 'Visita cancelada.';
      },
      aoFalharPorRede: () async {
        final fila = await ref.read(filaPendenteServiceProvider.future);
        await fila.enfileirar(
          tipo: TipoAcaoFila.cancelarVisita,
          timestamp: DateTime.now(),
          payload: {'visitaId': visita.id, 'comentario': comentario},
        );
        ref.invalidate(contagemPendentesProvider);
        return 'Sem conexão agora - cancelamento salvo e será enviado automaticamente '
            'quando a internet voltar.';
      },
    );
  }

  // Tenta obter a posição atual; se falhar (permissão negada, GPS
  // indisponível), decide entre BLOQUEAR (mostra aviso, quem chama deve
  // abortar) ou seguir sem posição, conforme
  // `permitirRegistroComGpsDesabilitado` (Épico 4, config-aba-
  // rastreio.jpg). O backend segue sendo a fonte de verdade - valida de
  // novo em todo caso.
  Future<({Position? posicao, bool bloqueado})> _obterPosicaoOuBloquear(
    BuildContext context,
    ConfiguracaoRastreio config,
  ) async {
    try {
      final posicao = await obterPosicaoAtual();
      return (posicao: posicao, bloqueado: false);
    } on PermissaoLocalizacaoNegadaException {
      if (config.permitirRegistroComGpsDesabilitado) {
        return (posicao: null, bloqueado: false);
      }
      if (context.mounted) {
        _mostrarSnackBar(context, 'Permissão de localização negada.');
      }
      return (posicao: null, bloqueado: true);
    } catch (erro) {
      if (config.permitirRegistroComGpsDesabilitado) {
        return (posicao: null, bloqueado: false);
      }
      if (context.mounted) {
        _mostrarSnackBar(context, 'Falha ao obter localização: $erro');
      }
      return (posicao: null, bloqueado: true);
    }
  }

  // Executa `acao`, mostrando estado de carregando no botão e um SnackBar
  // com o resultado (sucesso, com a mensagem que `acao` devolve) ou com
  // `erro.message` (ApiException - já é a mensagem clara vinda do backend,
  // ex: "fora do raio máximo", "visita em aberto", divergência de EXIF).
  // `aoFalharPorRede` (OS-MOBILE-22, gap encontrado nesta rodada) - só
  // check-in/checkout/cancelamento passam isso: em falha de REDE
  // especificamente (erro.statusCode == null - sem resposta nenhuma do
  // servidor, ver ApiClient._mensagemErro), em vez de mostrar erro e
  // PERDER a ação, enfileira pra reenvio automático (mesma fila do
  // rastreio, OS-MOBILE-31/36 já cobre o reenvio automático). Erro de
  // NEGÓCIO (statusCode preenchido - fora do raio, EXIF ausente, visita
  // já em aberto) continua caindo no fallback de baixo, mostrado direto -
  // enfileirar um erro que o servidor já rejeitou de propósito só adiaria
  // a mesma rejeição.
  Future<void> _executar(
    BuildContext context,
    Future<String> Function() acao, {
    Future<String> Function()? aoFalharPorRede,
  }) async {
    setState(() => _processando = true);
    try {
      final mensagem = await acao();
      if (context.mounted) _mostrarSnackBar(context, mensagem);
    } on ApiException catch (erro) {
      if (erro.statusCode == null && aoFalharPorRede != null) {
        final mensagem = await aoFalharPorRede();
        if (context.mounted) _mostrarSnackBar(context, mensagem);
      } else if (context.mounted) {
        _mostrarSnackBar(context, erro.message);
      }
    } catch (erro) {
      if (context.mounted) _mostrarSnackBar(context, 'Erro inesperado: $erro');
    } finally {
      if (mounted) setState(() => _processando = false);
    }
  }

  void _mostrarSnackBar(BuildContext context, String mensagem) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(mensagem)));
  }
}

/// Agendamento de visita sem check-in (OS-novas-implementacoes.md Bloco 5) -
/// mostra os próximos agendamentos DESTE vendedor pra este cliente e
/// permite criar um novo (data/hora). Quando o vendedor tem
/// `permiteCheckinSemAgendamento = false` (configurado pelo admin/web,
/// `Vendedor.permiteCheckinSemAgendamento`), o check-in em `_CardVisita`
/// exige um agendamento pra hoje - esse card é onde ele cria esse
/// agendamento antes.
class _CardAgendamento extends ConsumerWidget {
  const _CardAgendamento({required this.cliente});

  final ClienteDetalhe cliente;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agendamentos = ref.watch(agendamentosPorClienteProvider(cliente.id));

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Agendamento de visita',
                style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink),
              ),
              TextButton.icon(
                onPressed: () => _agendar(context, ref),
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Agendar'),
              ),
            ],
          ),
          const SizedBox(height: 4),
          agendamentos.when(
            loading: () => const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
            ),
            error: (erro, _) => Text(
              'Não foi possível carregar os agendamentos: $erro',
              style: const TextStyle(fontSize: 12, color: AppColors.muted),
            ),
            data: (lista) {
              final futuros = lista.toList()
                ..sort((a, b) => a.dataHoraPrevista.compareTo(b.dataHoraPrevista));
              if (futuros.isEmpty) {
                return const Text(
                  'Nenhum agendamento registrado para este cliente.',
                  style: TextStyle(fontSize: 12, color: AppColors.muted),
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final agendamento in futuros)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Row(
                        children: [
                          const Icon(Icons.event_outlined, size: 14, color: AppColors.muted),
                          const SizedBox(width: 6),
                          Text(
                            formatarDataHora(agendamento.dataHoraPrevista.toIso8601String()),
                            style: const TextStyle(fontSize: 12, color: AppColors.ink),
                          ),
                        ],
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Future<void> _agendar(BuildContext context, WidgetRef ref) async {
    final agora = DateTime.now();
    final data = await showDatePicker(
      context: context,
      initialDate: agora,
      firstDate: agora,
      lastDate: agora.add(const Duration(days: 365)),
    );
    if (data == null || !context.mounted) return;

    final hora = await showTimePicker(context: context, initialTime: TimeOfDay.now());
    if (hora == null || !context.mounted) return;

    final dataHora = DateTime(data.year, data.month, data.day, hora.hour, hora.minute);

    try {
      await ref
          .read(agendamentosVisitaServiceProvider)
          .criar(clienteId: cliente.id, dataHoraPrevista: dataHora);
      ref.invalidate(agendamentosPorClienteProvider(cliente.id));
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Agendamento criado.')));
      }
    } catch (erro) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Falha ao agendar: $erro')));
      }
    }
  }
}

// Retorna a nota digitada (string vazia se deixada em branco) ou `null` se
// o usuário cancelou o diálogo - distinção que o call site usa pra saber
// se deve seguir com a ação ou abortar.
// Retorna a nota digitada + o caminho FINAL da foto (pode ter mudado, se o
// usuário usou "Tirar novamente" - ver caminhoFoto abaixo). null quando
// cancelado. caminhoFoto só aparece (e só então o botão de refazer existe)
// quando a chamada envolve foto (check-in) - checkout não passa esse
// parâmetro.
Future<({String nota, String? caminhoFoto})?> _pedirNotaOpcional(
  BuildContext context, {
  required String titulo,
  required String textoConfirmar,
  String? caminhoFoto,
}) async {
  final controller = TextEditingController();
  String? fotoAtual = caminhoFoto;
  try {
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: Text(titulo),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (fotoAtual != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  // cacheWidth só reduz a resolução DECODIFICADA pra exibir
                  // a miniatura - o arquivo em si (enviado pro backend, com
                  // o EXIF intacto) não é alterado. Sem isso, decodificar a
                  // foto em resolução total (sem compressão desde o fix do
                  // EXIF) dentro de um diálogo já causou falha de asserção
                  // do framework em aparelho mais fraco.
                  child: Image.file(
                    File(fotoAtual!),
                    height: 160,
                    fit: BoxFit.cover,
                    cacheWidth: 800,
                    // Sem isso, trocar o arquivo (mesmo nome de path
                    // reaproveitado pelo image_picker em alguns aparelhos)
                    // podia manter a miniatura antiga em cache.
                    key: ValueKey(fotoAtual),
                  ),
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () async {
                      final novaFoto = await ImagePicker().pickImage(source: ImageSource.camera);
                      if (novaFoto == null) return;
                      setDialogState(() => fotoAtual = novaFoto.path);
                    },
                    icon: const Icon(Icons.replay, size: 16),
                    label: const Text('Tirar novamente'),
                  ),
                ),
                const SizedBox(height: 4),
              ],
              TextField(
                controller: controller,
                decoration: const InputDecoration(labelText: 'Nota (opcional)'),
                maxLines: 2,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text(textoConfirmar),
            ),
          ],
        ),
      ),
    );
    if (confirmado != true) return null;
    return (nota: controller.text.trim(), caminhoFoto: fotoAtual);
  } finally {
    controller.dispose();
  }
}

// Comentário OBRIGATÓRIO (cancelamento de visita) - botão "Confirmar" só
// habilita com texto não vazio (validado ao vivo via StatefulBuilder).
Future<String?> _pedirComentarioObrigatorio(
  BuildContext context, {
  required String titulo,
  required String explicacao,
}) async {
  final controller = TextEditingController();
  try {
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: Text(titulo),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(explicacao, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              const SizedBox(height: 10),
              TextField(
                controller: controller,
                decoration: const InputDecoration(labelText: 'Motivo'),
                maxLines: 2,
                onChanged: (_) => setDialogState(() {}),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Voltar'),
            ),
            FilledButton(
              onPressed: controller.text.trim().isEmpty
                  ? null
                  : () => Navigator.of(dialogContext).pop(true),
              child: const Text('Confirmar'),
            ),
          ],
        ),
      ),
    );
    if (confirmado != true) return null;
    return controller.text.trim();
  } finally {
    controller.dispose();
  }
}
