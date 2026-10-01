import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/models/cliente.dart';
import '../theme/app_colors.dart';
import 'app_badge.dart';
import 'app_card.dart';

/// Card de apresentação do cliente (topo do detalhe): identificação,
/// contato e endereço. Só leitura - toque num dado copia pro clipboard (sem
/// `url_launcher` no projeto, evita dependência nativa nova).
class CartaoCliente extends StatelessWidget {
  const CartaoCliente({super.key, required this.cliente});

  final ClienteDetalhe cliente;

  @override
  Widget build(BuildContext context) {
    final principal = cliente.enderecos.firstOrNull;
    final outros = cliente.enderecos.skip(1).toList();

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Column(
              children: [
                Container(
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    cliente.titulo.isNotEmpty ? cliente.titulo.substring(0, 1).toUpperCase() : '?',
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w800,
                      fontSize: 22,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  cliente.titulo,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                if (cliente.nomeFantasia != null && cliente.nomeFantasia != cliente.razaoSocial)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      cliente.nomeFantasia!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ),
                const SizedBox(height: 8),
                BadgeAtivoInativo(inativo: cliente.inativo),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Divider(color: AppColors.line, height: 1),
          const SizedBox(height: 14),
          const _Secao('Identificação'),
          _Campo(rotulo: 'Código', valor: cliente.codigo, copiavel: true),
          _Campo(rotulo: 'ID do cliente', valor: cliente.idExternoErp, copiavel: true),
          _Campo(rotulo: 'CPF/CNPJ', valor: cliente.cpfCnpj, copiavel: true),
          _Campo(rotulo: 'Inscrição estadual', valor: cliente.inscricaoEstadual, copiavel: true),
          const SizedBox(height: 6),
          const _Secao('Contato'),
          if (cliente.contato != null) _Campo(rotulo: 'Contato', valor: cliente.contato),
          _Campo(rotulo: 'Telefone', valores: cliente.telefones, copiavel: true),
          _Campo(rotulo: 'E-mail', valores: cliente.emails, copiavel: true),
          if (cliente.homepage != null)
            _Campo(rotulo: 'Site', valor: cliente.homepage, copiavel: true),
          const SizedBox(height: 6),
          const _Secao('Endereço'),
          if (principal == null)
            const Text(
              'Nenhum endereço cadastrado.',
              style: TextStyle(fontSize: 12, color: AppColors.muted),
            )
          else
            _BlocoEndereco(endereco: principal),
          if (outros.isNotEmpty)
            Theme(
              data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
              child: ExpansionTile(
                tilePadding: EdgeInsets.zero,
                childrenPadding: EdgeInsets.zero,
                expandedCrossAxisAlignment: CrossAxisAlignment.start,
                title: Text(
                  'Outros endereços (${outros.length})',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
                children: [
                  for (final endereco in outros)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _BlocoEndereco(endereco: endereco),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Secao extends StatelessWidget {
  const _Secao(this.titulo);

  final String titulo;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        titulo,
        style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink),
      ),
    );
  }
}

class _BlocoEndereco extends StatelessWidget {
  const _BlocoEndereco({required this.endereco});

  final EnderecoCliente endereco;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (endereco.tipo != null)
          Text(endereco.tipo!, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
        for (final linha in endereco.linhas)
          Text(linha, style: const TextStyle(fontSize: 13, color: AppColors.ink)),
      ],
    );
  }
}

/// Rótulo + valor(es); vazio mostra "—". `copiavel`: toque copia o valor.
class _Campo extends StatelessWidget {
  const _Campo({required this.rotulo, this.valor, this.valores, this.copiavel = false});

  final String rotulo;
  final String? valor;
  final List<String>? valores;
  final bool copiavel;

  @override
  Widget build(BuildContext context) {
    final itens = valores ?? [if (valor != null && valor!.isNotEmpty) valor!];

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(rotulo, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          if (itens.isEmpty)
            const Text('—', style: TextStyle(fontSize: 13, color: AppColors.ink))
          else
            for (final item in itens)
              InkWell(
                onTap: copiavel ? () => _copiar(context, item) : null,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 1),
                  child: Text(item, style: const TextStyle(fontSize: 13, color: AppColors.ink)),
                ),
              ),
        ],
      ),
    );
  }

  Future<void> _copiar(BuildContext context, String texto) async {
    await Clipboard.setData(ClipboardData(text: texto));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$rotulo copiado.'), duration: const Duration(seconds: 2)),
    );
  }
}
