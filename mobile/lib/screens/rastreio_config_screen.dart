import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../core/models/horario_trabalho.dart';
import '../core/providers/horario_trabalho_provider.dart';
import '../core/providers/offline_provider.dart';
import '../core/rastreio/rastreio_config.dart';
import '../core/rastreio/rastreio_service.dart';
import '../theme/app_colors.dart';
import '../widgets/app_card.dart';
import '../widgets/listagem_feedback.dart';

/// Tela de configuração do rastreio (OS-MOBILE-20) - liga/desliga +
/// intervalo de captura. Explicação clara do motivo ANTES de pedir
/// permissão (critério de aceite explícito da OS) - o texto abaixo
/// aparece sempre, não só na hora do pedido de permissão do SO.
///
/// Épico 4 (config-aba-rastreio.jpg) acrescentou: intervalo de captura
/// clampado pelo mínimo configurado pelo admin (tempoMinimoAcordarGpsMs)
/// e a seção de horário de trabalho individual
/// (_SecaoHorarioTrabalho, "Desabilitar edição de horário de trabalho
/// no Android").
class RastreioConfigScreen extends ConsumerWidget {
  const RastreioConfigScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(rastreioConfigProvider);
    final capturandoAgora = ref.watch(rastreioNotifierProvider);
    final configRastreioAsync = ref.watch(configuracaoRastreioProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Rastreio')),
      body: SafeArea(
        child: config.when(
          data: (dados) {
            // Só oferece intervalos que respeitam o mínimo configurado
            // pelo admin; enquanto a config ainda não baixou, assume sem
            // restrição (todas as opções).
            final tempoMinimoMs =
                configRastreioAsync.asData?.value.tempoMinimoAcordarGpsMs ?? 0;
            final opcoesPermitidas = opcoesIntervaloMinutos
                .where((minutos) => minutos * 60000 >= tempoMinimoMs)
                .toList();

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                AppCard(
                  child: Text(
                    'Compartilha sua localização periodicamente com o supervisor '
                    'enquanto o app estiver aberto ou em segundo plano, pra '
                    'acompanhar o roteiro da equipe em campo. Só funciona com o '
                    'app ainda em execução - se você fechar o app completamente, '
                    'a captura para até você abrir de novo.',
                    style: const TextStyle(fontSize: 12, color: AppColors.muted),
                  ),
                ),
                const SizedBox(height: 12),
                // OS-MOBILE-39 - gerenciamento de bateria agressivo de
                // alguns fabricantes (Xiaomi, Samsung, etc.) pode matar a
                // sincronização em segundo plano da fila offline mesmo com
                // o WorkManager configurado corretamente - fora do controle
                // do app, só orientação (fora de escopo automatizar aqui:
                // abrir a tela certa de exceção de bateria varia por
                // fabricante/versão do Android).
                AppCard(
                  child: Text(
                    'Se notar pedidos ou check-ins "aguardando envio" por muito '
                    'tempo mesmo com internet, procure nas configurações do '
                    'celular por "Bateria" > "Copperline" e libere a opção de '
                    '"Sem restrições"/"Não otimizar" - alguns celulares limitam '
                    'apps em segundo plano por padrão.',
                    style: const TextStyle(fontSize: 12, color: AppColors.muted),
                  ),
                ),
                const SizedBox(height: 16),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Rastreio ativo'),
                  subtitle: Text(capturandoAgora ? 'Capturando agora' : 'Desligado'),
                  value: dados.ativo,
                  activeThumbColor: AppColors.primary,
                  onChanged: (valor) => _alternar(ref, context, valor, dados.intervaloMinutos),
                ),
                const SizedBox(height: 16),
                Text('Intervalo de captura', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    for (final minutos in opcoesPermitidas)
                      ChoiceChip(
                        label: Text('$minutos min'),
                        selected: dados.intervaloMinutos == minutos,
                        onSelected: (selecionado) async {
                          if (!selecionado) return;
                          await ref.read(rastreioConfigProvider.notifier).definirIntervalo(minutos);
                          if (dados.ativo) {
                            await ref.read(rastreioNotifierProvider.notifier).iniciar(minutos);
                          }
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 24),
                const _SecaoHorarioTrabalho(),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (erro, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: ErroConexao(mensagem: erro.toString()),
          ),
        ),
      ),
    );
  }

  Future<void> _alternar(
    WidgetRef ref,
    BuildContext context,
    bool ligar,
    int intervaloMinutos,
  ) async {
    final configNotifier = ref.read(rastreioConfigProvider.notifier);
    final rastreioNotifier = ref.read(rastreioNotifierProvider.notifier);

    if (!ligar) {
      rastreioNotifier.parar();
      await configNotifier.definirAtivo(false);
      return;
    }

    final permissao = await rastreioNotifier.solicitarPermissao();
    if (permissao == LocationPermission.denied ||
        permissao == LocationPermission.deniedForever) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Permissão de localização negada - não é possível ativar o rastreio.'),
          ),
        );
      }
      return;
    }

    await rastreioNotifier.iniciar(intervaloMinutos);
    await configNotifier.definirAtivo(true);
  }
}

/// Horário de trabalho individual (Épico 4, config-aba-rastreio.jpg -
/// "Desabilitar edição de horário de trabalho no Android") - quando o
/// admin desabilita a edição (`edicaoDesabilitada`), mostra só leitura;
/// senão o vendedor escolhe início/fim via `showTimePicker` e salva via
/// PATCH /vendedores/me/horario-trabalho.
class _SecaoHorarioTrabalho extends ConsumerWidget {
  const _SecaoHorarioTrabalho();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final horarioAsync = ref.watch(horarioTrabalhoProvider);

    return horarioAsync.when(
      data: (horario) => _EditorHorarioTrabalho(horarioInicial: horario),
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error: (erro, _) => AppCard(child: Text('Falha ao carregar horário de trabalho: $erro')),
    );
  }
}

class _EditorHorarioTrabalho extends ConsumerStatefulWidget {
  const _EditorHorarioTrabalho({required this.horarioInicial});

  final HorarioTrabalho horarioInicial;

  @override
  ConsumerState<_EditorHorarioTrabalho> createState() => _EditorHorarioTrabalhoState();
}

class _EditorHorarioTrabalhoState extends ConsumerState<_EditorHorarioTrabalho> {
  late TimeOfDay? _inicio = _paraTimeOfDay(widget.horarioInicial.horarioInicioTrabalho);
  late TimeOfDay? _fim = _paraTimeOfDay(widget.horarioInicial.horarioFimTrabalho);
  bool _salvando = false;

  static TimeOfDay? _paraTimeOfDay(String? horario) {
    if (horario == null) return null;
    final partes = horario.split(':');
    return TimeOfDay(hour: int.parse(partes[0]), minute: int.parse(partes[1]));
  }

  static String _paraTexto(TimeOfDay horario) {
    final hora = horario.hour.toString().padLeft(2, '0');
    final minuto = horario.minute.toString().padLeft(2, '0');
    return '$hora:$minuto';
  }

  @override
  Widget build(BuildContext context) {
    final desabilitado = widget.horarioInicial.edicaoDesabilitada;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Horário de trabalho', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 4),
          Text(
            desabilitado
                ? 'Edição desabilitada pelo admin - o rastreio segue o horário global configurado.'
                : 'Personalize a janela em que seu rastreio fica ativo. Deixe em branco pra usar o horário global.',
            style: const TextStyle(fontSize: 12, color: AppColors.muted),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _CampoHorario(
                  rotulo: 'Início',
                  valor: _inicio,
                  habilitado: !desabilitado && !_salvando,
                  onSelecionar: (novo) => setState(() => _inicio = novo),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _CampoHorario(
                  rotulo: 'Fim',
                  valor: _fim,
                  habilitado: !desabilitado && !_salvando,
                  onSelecionar: (novo) => setState(() => _fim = novo),
                ),
              ),
            ],
          ),
          if (!desabilitado) ...[
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: _salvando || _inicio == null || _fim == null ? null : _salvar,
                child: Text(_salvando ? 'Salvando...' : 'Salvar'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _salvar() async {
    setState(() => _salvando = true);
    try {
      await ref
          .read(horarioTrabalhoServiceProvider)
          .atualizar(
            horarioInicioTrabalho: _paraTexto(_inicio!),
            horarioFimTrabalho: _paraTexto(_fim!),
          );
      ref.invalidate(horarioTrabalhoProvider);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Horário de trabalho salvo.')));
      }
    } catch (erro) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Falha ao salvar: $erro')));
      }
    } finally {
      if (mounted) setState(() => _salvando = false);
    }
  }
}

class _CampoHorario extends StatelessWidget {
  const _CampoHorario({
    required this.rotulo,
    required this.valor,
    required this.habilitado,
    required this.onSelecionar,
  });

  final String rotulo;
  final TimeOfDay? valor;
  final bool habilitado;
  final ValueChanged<TimeOfDay> onSelecionar;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: !habilitado
          ? null
          : () async {
              final selecionado = await showTimePicker(
                context: context,
                initialTime: valor ?? const TimeOfDay(hour: 8, minute: 0),
              );
              if (selecionado != null) onSelecionar(selecionado);
            },
      child: Text('$rotulo: ${valor?.format(context) ?? '—'}'),
    );
  }
}
