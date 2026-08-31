import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_exception.dart';
import '../core/providers/clientes_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_card.dart';

/// Verificação de conflito por CPF/CNPJ antes de cadastrar/prospectar um
/// cliente novo (OS-MOBILE-24) - "escopo de clientes por vendedor" é, na
/// prática, o vendedor não ver a carteira alheia (já garantido pelo
/// backend em GET /clientes, sem filtro extra necessário aqui) MAIS essa
/// tela, que existe justamente pro caso oposto: cliente já existe (talvez
/// de outro vendedor) e o app precisa avisar ANTES do vendedor sair a
/// campo prospectando alguém que já é atendido.
class VerificarConflitoScreen extends ConsumerStatefulWidget {
  const VerificarConflitoScreen({super.key});

  @override
  ConsumerState<VerificarConflitoScreen> createState() => _VerificarConflitoScreenState();
}

class _VerificarConflitoScreenState extends ConsumerState<VerificarConflitoScreen> {
  final _controller = TextEditingController();
  bool _consultando = false;
  ConflitoCliente? _resultado;
  String? _erro;
  String? _documentoConsultado;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _verificar() async {
    final documento = _controller.text.trim();
    if (documento.isEmpty) return;

    setState(() {
      _consultando = true;
      _erro = null;
      _resultado = null;
    });
    try {
      final resultado = await ref.read(conflitoClienteServiceProvider).verificar(documento);
      setState(() {
        _resultado = resultado;
        _documentoConsultado = documento;
      });
    } on ApiException catch (erro) {
      setState(() => _erro = erro.message);
    } catch (erro) {
      setState(() => _erro = 'Erro inesperado: $erro');
    } finally {
      if (mounted) setState(() => _consultando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Verificar conflito')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Confira se um CPF/CNPJ já é cliente (seu ou de outro vendedor) '
                    'antes de sair a campo prospectando.',
                    style: TextStyle(fontSize: 12, color: AppColors.muted),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _controller,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'CPF/CNPJ'),
                    onSubmitted: (_) => _verificar(),
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: FilledButton(
                      onPressed: _consultando ? null : _verificar,
                      child: Text(_consultando ? 'Verificando...' : 'Verificar'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (_erro != null)
              AppCard(
                child: Text(_erro!, style: const TextStyle(color: AppColors.ink)),
              ),
            if (_resultado != null) _CardResultado(resultado: _resultado!, documento: _documentoConsultado!),
          ],
        ),
      ),
    );
  }
}

class _CardResultado extends StatelessWidget {
  const _CardResultado({required this.resultado, required this.documento});

  final ConflitoCliente resultado;
  final String documento;

  @override
  Widget build(BuildContext context) {
    if (!resultado.existe) {
      return AppCard(
        child: Row(
          children: [
            const Icon(Icons.check_circle_outline, color: AppColors.accentGreen),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                '"$documento" não é cliente ainda - livre para prospecção.',
                style: const TextStyle(color: AppColors.ink),
              ),
            ),
          ],
        ),
      );
    }

    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline, color: AppColors.accentRed),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '"$documento" já é cliente.',
                  style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink),
                ),
                const SizedBox(height: 4),
                Text(
                  resultado.vendedorResponsavel != null
                      ? 'Atendido por ${resultado.vendedorResponsavel}.'
                      : 'Vendedor responsável não identificado.',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
