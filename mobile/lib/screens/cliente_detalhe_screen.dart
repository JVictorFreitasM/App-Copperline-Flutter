import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import '../core/api_exception.dart';
import '../core/localizacao_atual.dart';
import '../core/models/cliente.dart';
import '../core/models/cliente_resumo_llm.dart';
import '../core/models/visita.dart';
import '../core/providers/clientes_provider.dart';
import '../core/providers/cliente_resumo_llm_provider.dart';
import '../core/providers/visitas_provider.dart';
import '../core/formatacao.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/list_item_tile.dart';
import '../widgets/listagem_feedback.dart';
import '../widgets/stat_card.dart';

String _hojeIso() => DateTime.now().toIso8601String().substring(0, 10);

// Raio máximo aceito entre a posição do vendedor e o pin do cliente -
// mesmo valor do backend (RAIO_MAXIMO_METROS, visitas.service.ts), checado
// aqui ANTES de abrir a câmera/enviar a chamada só pra dar feedback
// imediato (o backend segue sendo a fonte de verdade, valida de novo).
const double _raioMaximoMetros = 50;

/// Detalhe do cliente (mobile, equivalente à OS-WEB-15) - mostra o que a
/// listagem não mostra: contatos. Só leitura. Sem endereços (mesmo recorte
/// do web: JSONB cru do WK Radar, sem schema estável pra um formulário
/// fixo, ver `core/models/cliente.dart`).
class ClienteDetalheScreen extends ConsumerWidget {
  const ClienteDetalheScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clienteAsync = ref.watch(clienteDetalheProvider(id));

    return Scaffold(
      appBar: AppBar(title: const Text('Cliente')),
      body: SafeArea(
        child: clienteAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (erro, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: erro is ApiException && erro.statusCode == 404
                ? EstadoVazio(mensagem: "Cliente '$id' não encontrado.")
                : ErroConexao(mensagem: '$erro'),
          ),
          data: (cliente) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      cliente.titulo,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ),
                  BadgeAtivoInativo(inativo: cliente.inativo),
                ],
              ),
              if (cliente.nomeFantasia != null && cliente.nomeFantasia != cliente.razaoSocial)
                Text(cliente.nomeFantasia!, style: const TextStyle(color: AppColors.muted)),
              const SizedBox(height: 16),
              _CardVisita(cliente: cliente),
              const SizedBox(height: 16),
              _CardResumoLlm(clienteId: id),
              const SizedBox(height: 16),
              AppCard(
                child: Text(
                  'CPF/CNPJ: ${cliente.cpfCnpj ?? "—"}',
                  style: const TextStyle(color: AppColors.ink),
                ),
              ),
              const SizedBox(height: 24),
              Text('Estatísticas', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              _CardEstatisticas(clienteId: id),
              const SizedBox(height: 24),
              Text('Histórico de visitas', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              _CardHistoricoVisitas(clienteId: id),
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
        childAspectRatio: 1.6,
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

/// Histórico de visitas DESTE cliente (OS-MOBILE-25, GET
/// /clientes/:id/visitas) - diferente da agenda do dia usada em
/// roteiro_screen.dart/_CardVisita (minhasVisitasProvider): aqui é o
/// histórico completo, sem filtro de data, mesmo critério de status
/// (cancelada/em andamento/concluída) já usado em roteiro_screen.dart.
class _CardHistoricoVisitas extends ConsumerWidget {
  const _CardHistoricoVisitas({required this.clienteId});

  final String clienteId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final visitas = ref.watch(clienteVisitasProvider(clienteId));

    return visitas.when(
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error: (erro, _) => ErroConexao(
        mensagem: '$erro',
        aoTentarNovamente: () => ref.invalidate(clienteVisitasProvider(clienteId)),
      ),
      data: (dados) => dados.isEmpty
          ? const EstadoVazio(mensagem: 'Nenhuma visita registrada para este cliente.')
          : Column(
              children: [
                for (final visita in dados) ...[
                  _ItemHistoricoVisita(visita: visita),
                  const SizedBox(height: 8),
                ],
              ],
            ),
    );
  }
}

class _ItemHistoricoVisita extends StatelessWidget {
  const _ItemHistoricoVisita({required this.visita});

  final Visita visita;

  @override
  Widget build(BuildContext context) {
    final String rotuloStatus;
    final bool enfaseStatus;
    if (visita.cancelada) {
      rotuloStatus = 'Cancelada';
      enfaseStatus = false;
    } else if (visita.emAndamento) {
      rotuloStatus = 'Em andamento';
      enfaseStatus = false;
    } else {
      rotuloStatus = 'Concluída';
      enfaseStatus = true;
    }

    return ListItemTile(
      titulo: 'Check-in ${formatarDataHora(visita.checkinEm)}',
      subtitulo: visita.checkoutEm != null
          ? 'Checkout ${formatarDataHora(visita.checkoutEm)}'
          : visita.nota ?? 'Sem nota',
      tag: AppBadge(texto: rotuloStatus, enfase: enfaseStatus),
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
            data: (visitas) => _conteudo(context, visitas),
          ),
        ],
      ),
    );
  }

  Widget _conteudo(BuildContext context, List<Visita> visitasHoje) {
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
        content: const Text(
          'Vai gravar a sua posição atual como o "pin" deste cliente. Confirma?',
        ),
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
    final posicao = await _obterPosicaoOuAvisar(context);
    if (posicao == null || !context.mounted) return;

    final distancia = Geolocator.distanceBetween(
      widget.cliente.localizacaoLat!,
      widget.cliente.localizacaoLng!,
      posicao.latitude,
      posicao.longitude,
    );
    if (distancia > _raioMaximoMetros) {
      _mostrarSnackBar(
        context,
        'Você está a ${distancia.round()}m do cliente - fora do raio de '
        '${_raioMaximoMetros.round()}m para check-in.',
      );
      return;
    }

    // Só câmera nativa - ImageSource.camera nunca abre a galeria (requisito
    // explícito da OS: sem opção de escolher foto existente). SEM
    // imageQuality: com compressão, o image_picker recodifica o arquivo em
    // muitos Android e derruba o EXIF (inclusive DateTimeOriginal) - o
    // backend EXIGE esse metadado pra aceitar o check-in (anti-fraude, ver
    // validar-exif-foto.ts), então comprimir aqui quebra o check-in
    // inteiro com "Foto sem metadado de data/hora (EXIF)".
    final foto = await ImagePicker().pickImage(source: ImageSource.camera);
    if (foto == null || !context.mounted) return;

    final nota = await _pedirNotaOpcional(
      context,
      titulo: 'Confirmar check-in',
      caminhoFoto: foto.path,
      textoConfirmar: 'Fazer check-in',
    );
    if (nota == null || !context.mounted) return;

    await _executar(context, () async {
      await ref
          .read(visitasAcoesServiceProvider)
          .checkin(
            clienteId: widget.cliente.id,
            latitude: posicao.latitude,
            longitude: posicao.longitude,
            caminhoFoto: foto.path,
            nota: nota,
          );
      ref.invalidate(minhasVisitasProvider(_hojeIso()));
      return 'Check-in registrado.';
    });
  }

  Future<void> _fazerCheckout(BuildContext context, Visita visita) async {
    final posicao = await _obterPosicaoOuAvisar(context);
    if (posicao == null || !context.mounted) return;

    final distancia = Geolocator.distanceBetween(
      widget.cliente.localizacaoLat!,
      widget.cliente.localizacaoLng!,
      posicao.latitude,
      posicao.longitude,
    );
    if (distancia > _raioMaximoMetros) {
      _mostrarSnackBar(
        context,
        'Você está a ${distancia.round()}m do cliente - fora do raio de '
        '${_raioMaximoMetros.round()}m para checkout.',
      );
      return;
    }

    final nota = await _pedirNotaOpcional(
      context,
      titulo: 'Confirmar checkout',
      textoConfirmar: 'Fazer checkout',
    );
    if (nota == null || !context.mounted) return;

    await _executar(context, () async {
      await ref
          .read(visitasAcoesServiceProvider)
          .checkout(
            visitaId: visita.id,
            latitude: posicao.latitude,
            longitude: posicao.longitude,
            nota: nota,
          );
      ref.invalidate(minhasVisitasProvider(_hojeIso()));
      return 'Checkout registrado.';
    });
  }

  Future<void> _cancelarVisita(BuildContext context, Visita visita) async {
    final comentario = await _pedirComentarioObrigatorio(
      context,
      titulo: 'Cancelar visita',
      explicacao: 'Obrigatório informar o motivo - seu supervisor será notificado.',
    );
    if (comentario == null || !context.mounted) return;

    await _executar(context, () async {
      await ref
          .read(visitasAcoesServiceProvider)
          .cancelar(visitaId: visita.id, comentario: comentario);
      ref.invalidate(minhasVisitasProvider(_hojeIso()));
      return 'Visita cancelada.';
    });
  }

  Future<Position?> _obterPosicaoOuAvisar(BuildContext context) async {
    try {
      return await obterPosicaoAtual();
    } on PermissaoLocalizacaoNegadaException {
      if (context.mounted) {
        _mostrarSnackBar(context, 'Permissão de localização negada.');
      }
      return null;
    } catch (erro) {
      if (context.mounted) {
        _mostrarSnackBar(context, 'Falha ao obter localização: $erro');
      }
      return null;
    }
  }

  // Executa `acao`, mostrando estado de carregando no botão e um SnackBar
  // com o resultado (sucesso, com a mensagem que `acao` devolve) ou com
  // `erro.message` (ApiException - já é a mensagem clara vinda do backend,
  // ex: "fora do raio máximo", "visita em aberto", divergência de EXIF).
  Future<void> _executar(BuildContext context, Future<String> Function() acao) async {
    setState(() => _processando = true);
    try {
      final mensagem = await acao();
      if (context.mounted) _mostrarSnackBar(context, mensagem);
    } on ApiException catch (erro) {
      if (context.mounted) _mostrarSnackBar(context, erro.message);
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

// Retorna a nota digitada (string vazia se deixada em branco) ou `null` se
// o usuário cancelou o diálogo - distinção que o call site usa pra saber
// se deve seguir com a ação ou abortar.
Future<String?> _pedirNotaOpcional(
  BuildContext context, {
  required String titulo,
  required String textoConfirmar,
  String? caminhoFoto,
}) async {
  final controller = TextEditingController();
  try {
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(titulo),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (caminhoFoto != null) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(File(caminhoFoto), height: 160, fit: BoxFit.cover),
              ),
              const SizedBox(height: 12),
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
    );
    if (confirmado != true) return null;
    return controller.text.trim();
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
