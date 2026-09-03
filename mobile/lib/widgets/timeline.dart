import 'package:flutter/material.dart';
import '../core/formatacao.dart';
import '../core/models/pedido.dart';
import '../core/models/timeline_evento.dart';
import '../theme/app_colors.dart';

/// Linha do tempo unificada (OS-MOBILE-40) - mesma logica visual do web
/// (`frontend/src/components/design/timeline.tsx`): um item por evento,
/// icone + titulo + descricao + data, ligados por uma linha vertical.
class Timeline extends StatelessWidget {
  const Timeline({super.key, required this.eventos});

  final List<TimelineEvento> eventos;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var indice = 0; indice < eventos.length; indice++)
          _ItemTimeline(
            evento: eventos[indice],
            ehUltimo: indice == eventos.length - 1,
          ),
      ],
    );
  }
}

class _ItemTimeline extends StatelessWidget {
  const _ItemTimeline({required this.evento, required this.ehUltimo});

  final TimelineEvento evento;
  final bool ehUltimo;

  @override
  Widget build(BuildContext context) {
    final (icone, titulo, descricao) = _conteudo(evento);
    final cancelada = evento.tipo == 'VISITA_CANCELADA';

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: cancelada ? AppColors.amberLight : AppColors.primaryLight,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Icon(
                  icone,
                  size: 16,
                  color: cancelada ? AppColors.amber : AppColors.primary,
                ),
              ),
              if (!ehUltimo) Expanded(child: Container(width: 1, color: AppColors.line)),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(top: 4, bottom: ehUltimo ? 0 : 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          titulo,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ),
                      Text(
                        formatarDataHora(evento.data),
                        style: const TextStyle(fontSize: 11, color: AppColors.muted),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(descricao, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  (IconData, String, String) _conteudo(TimelineEvento evento) {
    switch (evento.tipo) {
      case 'PEDIDO':
        final situacao = configSituacaoPedido(evento.situacao);
        final valor = evento.valorTotal != null ? ' · ${formatarMoeda(evento.valorTotal!)}' : '';
        return (
          Icons.receipt_long_outlined,
          'Pedido ${evento.pedidoNumero ?? "—"}',
          '${situacao.rotulo}$valor',
        );
      case 'PEDIDO_STATUS_ALTERADO':
        final anterior = evento.statusAnterior != null
            ? configSituacaoPedido(evento.statusAnterior).rotulo
            : '—';
        final novo = configSituacaoPedido(evento.statusNovo).rotulo;
        return (Icons.receipt_long_outlined, 'Status do pedido alterado', '$anterior → $novo');
      case 'VISITA_CHECKIN':
        return (Icons.login, 'Check-in de visita', 'Visita iniciada');
      case 'VISITA_CHECKOUT':
        return (Icons.logout, 'Checkout de visita', 'Visita concluída');
      case 'VISITA_CANCELADA':
        return (
          Icons.event_busy_outlined,
          'Visita cancelada',
          evento.motivoCancelamento ?? 'Sem motivo registrado',
        );
      case 'NOTA_FISCAL':
        return (
          Icons.description_outlined,
          'Nota fiscal ${evento.notaFiscalNumero ?? "—"}',
          evento.notaFiscalStatus ?? '—',
        );
      default:
        return (Icons.circle_outlined, evento.tipo, '');
    }
  }
}
