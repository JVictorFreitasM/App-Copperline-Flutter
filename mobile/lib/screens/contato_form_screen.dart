import 'package:flutter/material.dart';
import '../core/models/cadastro_cliente.dart';
import '../core/models/documento_brasileiro.dart';
import '../theme/app_colors.dart';
import '../widgets/cadastro_cliente/campo_telefones.dart';

/// "Adicionar contato ao cliente" da tela de referência. O contato do
/// cadastro no WK Radar tem UM telefone, por isso o campo aceita só 1.
/// Devolve o [ContatoFormulario] ao criar (ou nada, se cancelar).
class ContatoFormScreen extends StatefulWidget {
  const ContatoFormScreen({super.key});

  @override
  State<ContatoFormScreen> createState() => _ContatoFormScreenState();
}

class _ContatoFormScreenState extends State<ContatoFormScreen> {
  final _nome = TextEditingController();
  final _funcao = TextEditingController();
  final _email = TextEditingController();
  List<Telefone> _telefones = const [];
  DateTime? _nascimento;
  String? _erro;

  @override
  void dispose() {
    _nome.dispose();
    _funcao.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _escolherNascimento() async {
    final agora = DateTime.now();
    final data = await showDatePicker(
      context: context,
      initialDate: _nascimento ?? DateTime(agora.year - 30),
      firstDate: DateTime(1900),
      lastDate: agora,
      helpText: 'Data de aniversário',
    );
    if (data != null) setState(() => _nascimento = data);
  }

  String get _nascimentoIso => _nascimento == null
      ? ''
      : '${_nascimento!.year.toString().padLeft(4, '0')}-'
            '${_nascimento!.month.toString().padLeft(2, '0')}-'
            '${_nascimento!.day.toString().padLeft(2, '0')}';

  void _criar() {
    if (_nome.text.trim().isEmpty) {
      setState(() => _erro = 'Informe o nome do contato.');
      return;
    }
    if (_email.text.trim().isNotEmpty && !emailEhValido(_email.text)) {
      setState(() => _erro = 'E-mail inválido.');
      return;
    }
    Navigator.of(context).pop(
      ContatoFormulario(
        nome: _nome.text,
        funcao: _funcao.text,
        email: _email.text,
        telefone: _telefones.isEmpty ? null : _telefones.first,
        dataNascimento: _nascimentoIso,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Adicionar contato ao cliente')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            TextField(
              controller: _nome,
              maxLength: 50,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Nome',
                hintText: 'Nome do contato',
                counterText: '',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _funcao,
              maxLength: 30,
              decoration: const InputDecoration(
                labelText: 'Cargo',
                hintText: 'Cargo ou função',
                counterText: '',
              ),
            ),
            const SizedBox(height: 12),
            CampoTelefones(
              rotulo: 'Telefone',
              telefones: _telefones,
              max: 1,
              aoMudar: (telefones) => setState(() => _telefones = telefones),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _email,
              maxLength: 64,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'E-mail',
                hintText: 'Email do contato',
                counterText: '',
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _escolherNascimento,
              icon: const Icon(Icons.cake_outlined, size: 18),
              label: Text(
                _nascimento == null
                    ? 'Data de aniversário'
                    : 'Aniversário: ${_nascimento!.day.toString().padLeft(2, '0')}/'
                          '${_nascimento!.month.toString().padLeft(2, '0')}/${_nascimento!.year}',
              ),
            ),
            if (_erro != null) ...[
              const SizedBox(height: 10),
              Text(_erro!, style: const TextStyle(fontSize: 12, color: AppColors.red)),
            ],
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Cancelar'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(child: FilledButton(onPressed: _criar, child: const Text('Criar'))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
