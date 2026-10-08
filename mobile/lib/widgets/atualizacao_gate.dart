import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/atualizacao/notas_versao.dart';
import '../core/providers/atualizacao_provider.dart';
import '../screens/atualizacao_obrigatoria_screen.dart';

/// Envolve o app logado: se há versão mais nova publicada, troca tudo pela tela
/// de atualização obrigatória. Confere ao abrir (já logado - o endpoint exige
/// sessão) e toda vez que o app volta pro primeiro plano. Enquanto confere, ou
/// se não conseguir conferir (sem rede), mostra o app normalmente.
class AtualizacaoGate extends ConsumerStatefulWidget {
  const AtualizacaoGate({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AtualizacaoGate> createState() => _AtualizacaoGateState();
}

class _AtualizacaoGateState extends ConsumerState<AtualizacaoGate> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Primeira abertura depois de atualizar: mostra o que há de novo (uma vez).
    WidgetsBinding.instance.addPostFrameCallback((_) => _mostrarNovidades());
  }

  Future<void> _mostrarNovidades() async {
    try {
      final servico = ref.read(atualizacaoAppServiceProvider);
      final novidades = await servico.novidadesParaMostrar();
      if (novidades == null || !mounted) return;
      // Marca ANTES de mostrar: se o app fechar com o aviso aberto, não repete.
      await servico.marcarNovidadesVistas(novidades.versionCode);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => _DialogNovidades(notas: novidades),
      );
    } catch (_) {
      // Novidades são um complemento: qualquer falha aqui (serviço indisponível,
      // armazenamento) nunca pode derrubar o app nem o gate de atualização.
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState estado) {
    if (estado == AppLifecycleState.resumed) {
      ref.invalidate(atualizacaoAppProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    // `.value` mantém o resultado anterior durante a reconferência - sem piscar
    // entre a tela de atualização e o app.
    final atualizacao = ref.watch(atualizacaoAppProvider).value;
    if (atualizacao != null) {
      return AtualizacaoObrigatoriaScreen(atualizacao: atualizacao);
    }
    return widget.child;
  }
}

/// "Novidades da versão X" - aparece uma vez, na primeira abertura depois de
/// atualizar.
class _DialogNovidades extends StatelessWidget {
  const _DialogNovidades({required this.notas});

  final NotasVersao notas;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Novidades da versão ${notas.versionName}'),
      content: SingleChildScrollView(child: Text(notas.notas)),
      actions: [
        FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Entendi')),
      ],
    );
  }
}
