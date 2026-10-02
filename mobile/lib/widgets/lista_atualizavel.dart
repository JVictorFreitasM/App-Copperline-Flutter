import 'package:flutter/material.dart';

/// `ListView` com "puxar de cima pra baixo pra atualizar" - mesmo contrato de
/// `ListView(padding, children)` + `aoAtualizar`. O `AlwaysScrollableScrollPhysics`
/// faz o gesto funcionar também quando a lista é curta (cabe na tela).
class ListaAtualizavel extends StatelessWidget {
  const ListaAtualizavel({
    super.key,
    required this.aoAtualizar,
    required this.children,
    this.padding,
  });

  final Future<void> Function() aoAtualizar;
  final List<Widget> children;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: aoAtualizar,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: padding,
        children: children,
      ),
    );
  }
}
