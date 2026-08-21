import 'package:flutter/material.dart';

/// Card branco flutuando sobre o fundo (ver skill `design-system`) - widget
/// compartilhado em vez de recriar `Card`+`Padding` em cada tela.
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: padding ?? const EdgeInsets.all(20),
        child: child,
      ),
    );
  }
}
