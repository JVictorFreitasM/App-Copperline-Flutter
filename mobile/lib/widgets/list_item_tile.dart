import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Mesmo vocabulário visual do `ListItem` web
/// (`frontend/src/components/design/list-item.tsx`) - avatar circular com
/// inicial, título, subtítulo, valor à direita e uma tag opcional (badge de
/// situação/ativo-inativo). Widget único reaproveitado em toda listagem
/// (clientes/produtos/pedidos/contatos), nunca recriado por tela.
class ListItemTile extends StatelessWidget {
  const ListItemTile({
    super.key,
    required this.titulo,
    this.subtitulo,
    this.valor,
    this.tag,
    this.onTap,
    this.trailingAction,
  });

  final String titulo;
  final String? subtitulo;
  final String? valor;
  final Widget? tag;
  final VoidCallback? onTap;

  // Botão com toque próprio (ex: favoritar, OS-MOBILE-15) - fica FORA da
  // área de InkWell do resto da linha, num Row irmão, pra não disparar
  // `onTap` (navegação) ao tocar nele.
  final Widget? trailingAction;

  @override
  Widget build(BuildContext context) {
    final inicial = titulo.isNotEmpty ? titulo.characters.first.toUpperCase() : '?';

    return Card(
      margin: EdgeInsets.zero,
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: AppColors.primaryLight,
                      child: Text(
                        inicial,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            titulo,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              color: AppColors.ink,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (subtitulo != null) ...[
                            const SizedBox(height: 2),
                            Text(
                              subtitulo!,
                              style: const TextStyle(fontSize: 12, color: AppColors.muted),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (valor != null || tag != null) ...[
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (valor != null)
                            Text(
                              valor!,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                color: AppColors.ink,
                              ),
                            ),
                          if (tag != null) ...[const SizedBox(height: 4), tag!],
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
          if (trailingAction != null)
            Padding(padding: const EdgeInsets.only(right: 10), child: trailingAction),
        ],
      ),
    );
  }
}
