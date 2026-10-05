import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_exception.dart';
import '../core/formatacao.dart';
import '../core/models/notificacao.dart';
import '../core/providers/notificacoes_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/listagem_feedback.dart';

/// Detalhe de uma mensagem manual do admin: assunto, texto completo (a
/// lista só mostra um trecho), quem enviou, pra quem e quando. Abre ao tocar
/// na mensagem na lista de notificações ou no push (`mensagemId` no
/// payload). Abrir já marca como lida.
class NotificacaoMensagemDetalheScreen extends ConsumerStatefulWidget {
  const NotificacaoMensagemDetalheScreen({super.key, required this.mensagemId});

  final String mensagemId;

  @override
  ConsumerState<NotificacaoMensagemDetalheScreen> createState() =>
      _NotificacaoMensagemDetalheScreenState();
}

class _NotificacaoMensagemDetalheScreenState
    extends ConsumerState<NotificacaoMensagemDetalheScreen> {
  bool _marcadaComoLida = false;

  Future<void> _marcarComoLida(Notificacao notificacao) async {
    if (_marcadaComoLida || notificacao.lida) return;
    _marcadaComoLida = true;
    try {
      await ref.read(notificacoesServiceProvider).marcarComoLida(notificacao.id);
      // Atualiza a lista e o selo do sino por trás desta tela.
      ref.invalidate(contagemNaoLidasProvider);
      ref.invalidate(notificacoesProvider);
    } catch (_) {
      // Falhar em marcar como lida não impede de ler a mensagem - a lista
      // continua oferecendo "Marcar como lida".
      _marcadaComoLida = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final detalheAsync = ref.watch(mensagemDetalheProvider(widget.mensagemId));

    ref.listen(mensagemDetalheProvider(widget.mensagemId), (_, proximo) {
      proximo.whenData((detalhe) => _marcarComoLida(detalhe.notificacao));
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Mensagem')),
      body: SafeArea(
        child: detalheAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (erro, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: erro is ApiException && erro.statusCode == 404
                ? const EstadoVazio(mensagem: 'Mensagem não encontrada.')
                : ErroConexao(
                    mensagem: '$erro',
                    aoTentarNovamente: () =>
                        ref.invalidate(mensagemDetalheProvider(widget.mensagemId)),
                  ),
          ),
          data: (detalhe) => _Conteudo(detalhe: detalhe),
        ),
      ),
    );
  }
}

class _Conteudo extends StatelessWidget {
  const _Conteudo({required this.detalhe});

  final NotificacaoDetalhe detalhe;

  @override
  Widget build(BuildContext context) {
    final notificacao = detalhe.notificacao;
    final mensagem = detalhe.mensagem;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (mensagem != null && mensagem.periodica) ...[
                const AppBadge(texto: 'Mensagem periódica'),
                const SizedBox(height: 10),
              ],
              Text(notificacao.titulo, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 16),
              // SelectableText: o vendedor pode copiar um link, telefone ou
              // código que venha na mensagem.
              SelectableText(notificacao.corpo, style: const TextStyle(fontSize: 15, height: 1.45)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        AppCard(
          child: Column(
            children: [
              if (mensagem != null) ...[
                _LinhaInfo(rotulo: 'Enviada por', valor: mensagem.autorNome),
                _LinhaInfo(rotulo: 'Para', valor: mensagem.destinoRotulo),
              ],
              _LinhaInfo(
                rotulo: 'Recebida em',
                valor: formatarDataHora(notificacao.criadoEm),
                ultima: true,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _LinhaInfo extends StatelessWidget {
  const _LinhaInfo({required this.rotulo, required this.valor, this.ultima = false});

  final String rotulo;
  final String valor;
  final bool ultima;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: ultima ? 0 : 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(rotulo, style: const TextStyle(fontSize: 13, color: AppColors.muted)),
          ),
          Expanded(
            child: Text(valor, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
