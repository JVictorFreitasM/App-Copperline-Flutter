import 'package:flutter/material.dart';
import '../../core/models/cadastro_cliente.dart';
import '../../theme/app_colors.dart';

/// Valores especiais do seletor (os endereços são os índices 0..n).
const seletorEnderecoADefinir = -1;
const seletorEnderecoNovo = -2;

/// Seletor "Endereço de Cobrança/Entrega" da tela de referência: "A definir",
/// os endereços já informados neste formulário e "+ Cadastrar novo
/// endereço..." (abre a tela de endereço). Mostra o escolhido em duas linhas.
class SeletorEndereco extends StatelessWidget {
  const SeletorEndereco({
    super.key,
    required this.rotulo,
    required this.enderecos,
    required this.selecionado,
    required this.aoEscolher,
  });

  final String rotulo;
  final List<EnderecoFormulario> enderecos;
  final int? selecionado;
  final ValueChanged<int> aoEscolher;

  @override
  Widget build(BuildContext context) {
    final escolhido = selecionado != null && selecionado! < enderecos.length
        ? enderecos[selecionado!]
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<int>(
          key: ValueKey('$rotulo-${enderecos.length}-$selecionado'),
          initialValue: selecionado ?? seletorEnderecoADefinir,
          isExpanded: true,
          decoration: InputDecoration(labelText: rotulo),
          items: [
            const DropdownMenuItem(value: seletorEnderecoADefinir, child: Text('A definir')),
            for (var i = 0; i < enderecos.length; i++)
              DropdownMenuItem(
                value: i,
                child: Text(enderecos[i].descricao.$1, overflow: TextOverflow.ellipsis),
              ),
            const DropdownMenuItem(
              value: seletorEnderecoNovo,
              child: Text('+ Cadastrar novo endereço...'),
            ),
          ],
          onChanged: (valor) {
            if (valor != null) aoEscolher(valor);
          },
        ),
        if (escolhido != null) ...[
          const SizedBox(height: 6),
          Text(escolhido.descricao.$1, style: const TextStyle(fontSize: 13)),
          Text(
            escolhido.descricao.$2,
            style: const TextStyle(fontSize: 12, color: AppColors.muted),
          ),
        ],
      ],
    );
  }
}
