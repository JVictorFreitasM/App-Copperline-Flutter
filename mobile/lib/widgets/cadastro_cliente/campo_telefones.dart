import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/models/documento_brasileiro.dart';
import '../../theme/app_colors.dart';

/// Lista de telefones com "Adicionar telefone" (botão da tela de referência):
/// abre DDD + número, valida (DDD 2 dígitos, número 8/9) e entra na lista.
/// `max` limita quantos (o contato do cadastro no Radar aceita só 1).
class CampoTelefones extends StatefulWidget {
  const CampoTelefones({
    super.key,
    required this.rotulo,
    required this.telefones,
    required this.aoMudar,
    this.max = 5,
  });

  final String rotulo;
  final List<Telefone> telefones;
  final ValueChanged<List<Telefone>> aoMudar;
  final int max;

  @override
  State<CampoTelefones> createState() => _CampoTelefonesState();
}

class _CampoTelefonesState extends State<CampoTelefones> {
  final _dddController = TextEditingController();
  final _numeroController = TextEditingController();
  bool _adicionando = false;
  String? _erro;

  @override
  void dispose() {
    _dddController.dispose();
    _numeroController.dispose();
    super.dispose();
  }

  void _confirmar() {
    final novo = Telefone(
      ddd: _dddController.text.replaceAll(RegExp(r'\D'), ''),
      numero: _numeroController.text.replaceAll(RegExp(r'\D'), ''),
    );
    if (!novo.valido) {
      setState(() => _erro = 'Informe DDD (2 dígitos) e número (8 ou 9 dígitos).');
      return;
    }
    widget.aoMudar([...widget.telefones, novo]);
    _dddController.clear();
    _numeroController.clear();
    setState(() {
      _erro = null;
      _adicionando = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.rotulo, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            for (final telefone in widget.telefones)
              InputChip(
                label: Text(telefone.formatado),
                onDeleted: () =>
                    widget.aoMudar(widget.telefones.where((t) => t != telefone).toList()),
              ),
            if (!_adicionando && widget.telefones.length < widget.max)
              OutlinedButton.icon(
                onPressed: () => setState(() => _adicionando = true),
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Adicionar telefone'),
              ),
          ],
        ),
        if (_adicionando) ...[
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 72,
                child: TextField(
                  controller: _dddController,
                  keyboardType: TextInputType.number,
                  maxLength: 2,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(labelText: 'DDD', counterText: ''),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _numeroController,
                  keyboardType: TextInputType.phone,
                  maxLength: 9,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(labelText: 'Número', counterText: ''),
                  onSubmitted: (_) => _confirmar(),
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: FilledButton(onPressed: _confirmar, child: const Text('OK')),
              ),
            ],
          ),
          TextButton(
            onPressed: () => setState(() {
              _adicionando = false;
              _erro = null;
            }),
            child: const Text('Cancelar'),
          ),
        ],
        if (_erro != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(_erro!, style: const TextStyle(fontSize: 12, color: AppColors.red)),
          ),
      ],
    );
  }
}
