import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Stepper visual de status do pedido (OS-MOBILE-42) - so' usa
/// Pedido.situacao (real, sempre presente). As etapas "aguardando
/// aprovação"/"aprovado" do texto original da OS dependem de
/// Pedido.statusLocal, campo que so existe pra pedido criado localmente
/// pelo app (ainda bloqueado, OS-BACKEND-25) - hoje sairiam sempre
/// "não alcançadas" pra 100% dos pedidos (dado enganoso, nao "sem dado").
/// Mesma progressao de 4 etapas ja usada no funil do painel web
/// (OS-WEB-41, ver montar-funil-pedidos.ts no backend), adaptada pra um
/// unico pedido em vez de contagem agregada.
const _etapas = ['Criado', 'Em processamento', 'Atendimento parcial', 'Concluído'];

const _situacoesProcessamento = {'EM_ANALISE', 'PENDENTE'};
const _situacoesParcial = {'PARCIALMENTE_ATENDIDO', 'PARCIALMENTE_FATURADO'};
const _situacoesConcluido = {'ATENDIDO', 'FATURADO'};

int _etapaAtual(String? situacao) {
  if (situacao == null) return 0;
  if (_situacoesConcluido.contains(situacao)) return 3;
  if (_situacoesParcial.contains(situacao)) return 2;
  if (_situacoesProcessamento.contains(situacao)) return 1;
  return 0;
}

class PedidoStepper extends StatelessWidget {
  const PedidoStepper({super.key, required this.situacao});

  final String? situacao;

  @override
  Widget build(BuildContext context) {
    final parado = situacao == 'CANCELADO' || situacao == 'BLOQUEADO';
    final etapaAtual = _etapaAtual(situacao);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            for (var i = 0; i < _etapas.length; i++) ...[
              _Circulo(alcancada: !parado && i <= etapaAtual),
              if (i < _etapas.length - 1)
                Expanded(
                  child: Container(
                    height: 2,
                    color: !parado && i < etapaAtual ? AppColors.primary : AppColors.line,
                  ),
                ),
            ],
          ],
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            for (var i = 0; i < _etapas.length; i++)
              Expanded(
                child: Text(
                  _etapas[i],
                  textAlign: i == 0
                      ? TextAlign.start
                      : (i == _etapas.length - 1 ? TextAlign.end : TextAlign.center),
                  style: TextStyle(
                    fontSize: 10,
                    color: !parado && i <= etapaAtual ? AppColors.ink : AppColors.muted,
                    fontWeight: !parado && i == etapaAtual ? FontWeight.w700 : FontWeight.w400,
                  ),
                ),
              ),
          ],
        ),
        if (parado) ...[
          const SizedBox(height: 8),
          Text(
            situacao == 'CANCELADO' ? 'Pedido cancelado' : 'Pedido bloqueado',
            style: const TextStyle(fontSize: 12, color: AppColors.amber, fontWeight: FontWeight.w600),
          ),
        ],
      ],
    );
  }
}

class _Circulo extends StatelessWidget {
  const _Circulo({required this.alcancada});

  final bool alcancada;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 14,
      height: 14,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: alcancada ? AppColors.primary : AppColors.surface,
        border: Border.all(color: alcancada ? AppColors.primary : AppColors.line, width: 2),
      ),
    );
  }
}
