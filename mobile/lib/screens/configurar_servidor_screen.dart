import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/server_config.dart';
import '../theme/app_colors.dart';

/// Tela de configuração do endereço do servidor (backend), exibida ANTES
/// do login - pedido explícito do usuário: o IP da rede local (DHCP)
/// muda com frequência, e até aqui cada mudança exigia recompilar e
/// reinstalar o app inteiro (--dart-define=API_BASE_URL, fixo em tempo de
/// build). Agora a URL é lida/gravada em runtime (SharedPreferences via
/// ServerConfigService) - mudar o IP não exige mais rebuild, só reabrir
/// esta tela e salvar de novo.
///
/// Dois usos: (1) bloqueante, sem [permitirVoltar], quando ainda não há
/// nenhuma URL configurada (primeira abertura de um build sem
/// --dart-define, ou usuário limpou os dados do app); (2) editável a
/// qualquer momento a partir de um botão na LoginScreen, com
/// [permitirVoltar] true.
class ConfigurarServidorScreen extends ConsumerStatefulWidget {
  const ConfigurarServidorScreen({super.key, this.permitirVoltar = false});

  final bool permitirVoltar;

  @override
  ConsumerState<ConfigurarServidorScreen> createState() => _ConfigurarServidorScreenState();
}

class _ConfigurarServidorScreenState extends ConsumerState<ConfigurarServidorScreen> {
  late final TextEditingController _controller;
  String? _erro;
  bool _salvando = false;

  @override
  void initState() {
    super.initState();
    final urlAtual = ref.read(serverUrlProvider);
    _controller = TextEditingController(text: urlAtual ?? '');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  // Aceita com ou sem porta/caminho, mas exige o esquema explícito - sem
  // isso o Dio trataria um valor tipo "192.168.2.97:3010" como caminho
  // relativo em vez de host, falhando de um jeito confuso de diagnosticar.
  String? _validar(String valor) {
    final texto = valor.trim();
    if (texto.isEmpty) {
      return 'Informe o endereço do servidor.';
    }
    final uri = Uri.tryParse(texto);
    if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https') || uri.host.isEmpty) {
      return 'Endereço inválido - use o formato http://IP:PORTA (ex: http://IP-DO-SERVIDOR:3010).';
    }
    return null;
  }

  Future<void> _salvar() async {
    final texto = _controller.text.trim();
    // Remove barra final - evita URLs duplas tipo "http://host:3010//pedidos"
    // quando o path da API já começa com "/".
    final normalizada = texto.endsWith('/') ? texto.substring(0, texto.length - 1) : texto;

    final erro = _validar(normalizada);
    if (erro != null) {
      setState(() => _erro = erro);
      return;
    }

    setState(() {
      _erro = null;
      _salvando = true;
    });

    final service = ref.read(serverConfigServiceProvider);
    await service.salvarUrl(normalizada);
    // Propaga pra apiClientProvider/logoutServiceProvider (ambos watcham
    // serverUrlProvider) - qualquer chamada de API seguinte já usa o
    // endereço novo, sem reiniciar o app.
    ref.read(serverUrlProvider.notifier).definir(normalizada);

    if (!mounted) return;
    setState(() => _salvando = false);
    if (widget.permitirVoltar && Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Configurar servidor'),
        automaticallyImplyLeading: widget.permitirVoltar,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text(
                'Endereço do servidor',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: AppColors.ink),
              ),
              const SizedBox(height: 8),
              const Text(
                'Informe o endereço da API do Copperline (ex: http://IP-DO-SERVIDOR:3010). '
                'Se o IP do servidor mudar, volte aqui e atualize - não precisa reinstalar o app.',
                style: TextStyle(fontSize: 13, color: AppColors.muted),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _controller,
                keyboardType: TextInputType.url,
                autocorrect: false,
                decoration: InputDecoration(
                  labelText: 'Endereço do servidor',
                  hintText: 'http://IP-DO-SERVIDOR:3010',
                  errorText: _erro,
                  border: const OutlineInputBorder(),
                ),
                onSubmitted: (_) => _salvar(),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _salvando ? null : _salvar,
                  child: _salvando
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Salvar'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
