import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import '../core/formatacao.dart';
import '../core/models/cliente.dart';
import '../core/models/visita.dart';
import '../core/providers/roteiro_provider.dart';
import '../core/providers/visitas_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/list_item_tile.dart';
import '../widgets/listagem_feedback.dart';
import 'cliente_detalhe_screen.dart';

String _hojeIso() => DateTime.now().toIso8601String().substring(0, 10);

/// Roteiro e mapa de visitas (OS-MOBILE-17) - mapa com os clientes da
/// carteira que já têm "pin" definido (GET /clientes, OS-BACKEND-28) +
/// agenda do dia (GET /visitas/minhas, OS-MOBILE-17 - "minhas visitas" é
/// endpoint novo: GET /visitas já existente é supervisor-only, ver
/// VisitasController). Sem roteirização otimizada (critério de aceite
/// explícito da OS) - só exibição dos pontos.
class RoteiroScreen extends ConsumerWidget {
  const RoteiroScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clientes = ref.watch(clientesComLocalizacaoProvider);
    final visitas = ref.watch(minhasVisitasProvider(_hojeIso()));

    return Scaffold(
      appBar: AppBar(title: const Text('Roteiro')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(clientesComLocalizacaoProvider);
            ref.invalidate(minhasVisitasProvider(_hojeIso()));
            await Future.wait([
              ref.read(clientesComLocalizacaoProvider.future),
              ref.read(minhasVisitasProvider(_hojeIso()).future),
            ]);
          },
          child: ListView(
            children: [
              SizedBox(
                height: 320,
                child: clientes.when(
                  data: (dados) => _MapaClientes(clientes: dados),
                  loading: () =>
                      const Center(child: CircularProgressIndicator(color: AppColors.primary)),
                  error: (erro, _) => Padding(
                    padding: const EdgeInsets.all(16),
                    child: ErroConexao(
                      mensagem: erro.toString(),
                      aoTentarNovamente: () => ref.invalidate(clientesComLocalizacaoProvider),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Visitas de hoje', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 12),
                    visitas.when(
                      data: (dados) => dados.isEmpty
                          ? const EstadoVazio(mensagem: 'Nenhuma visita registrada hoje.')
                          : clientes.when(
                              data: (clientesComPin) => Column(
                                children: [
                                  for (final visita in dados) ...[
                                    _ItemVisita(
                                      visita: visita,
                                      cliente: _acharCliente(clientesComPin, visita.clienteId),
                                    ),
                                    const SizedBox(height: 8),
                                  ],
                                ],
                              ),
                              loading: () => Column(
                                children: [
                                  for (final visita in dados) ...[
                                    _ItemVisita(visita: visita, cliente: null),
                                    const SizedBox(height: 8),
                                  ],
                                ],
                              ),
                              error: (_, _) => Column(
                                children: [
                                  for (final visita in dados) ...[
                                    _ItemVisita(visita: visita, cliente: null),
                                    const SizedBox(height: 8),
                                  ],
                                ],
                              ),
                            ),
                      loading: () =>
                          const Center(child: CircularProgressIndicator(color: AppColors.primary)),
                      error: (erro, _) => ErroConexao(
                        mensagem: erro.toString(),
                        aoTentarNovamente: () =>
                            ref.invalidate(minhasVisitasProvider(_hojeIso())),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  ClienteResumo? _acharCliente(List<ClienteResumo> clientes, String clienteId) {
    for (final cliente in clientes) {
      if (cliente.id == clienteId) return cliente;
    }
    return null;
  }
}

class _MapaClientes extends StatelessWidget {
  const _MapaClientes({required this.clientes});

  final List<ClienteResumo> clientes;

  @override
  Widget build(BuildContext context) {
    if (clientes.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: EstadoVazio(
          mensagem:
              'Nenhum cliente da carteira com localização definida ainda - defina o "pin" no detalhe do cliente.',
        ),
      );
    }

    final centro = LatLng(clientes.first.localizacaoLat!, clientes.first.localizacaoLng!);

    return FlutterMap(
      options: MapOptions(initialCenter: centro, initialZoom: 11),
      children: [
        TileLayer(
          urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'br.com.copperline.copperline_mobile',
        ),
        MarkerLayer(
          markers: [
            for (final cliente in clientes)
              Marker(
                point: LatLng(cliente.localizacaoLat!, cliente.localizacaoLng!),
                width: 36,
                height: 36,
                child: GestureDetector(
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => ClienteDetalheScreen(id: cliente.id)),
                  ),
                  child: const Icon(Icons.location_on, color: AppColors.primary, size: 36),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _ItemVisita extends StatelessWidget {
  const _ItemVisita({required this.visita, required this.cliente});

  final Visita visita;
  final ClienteResumo? cliente;

  @override
  Widget build(BuildContext context) {
    final String rotuloStatus;
    final bool enfaseStatus;
    if (visita.cancelada) {
      rotuloStatus = 'Cancelada';
      enfaseStatus = false;
    } else if (visita.emAndamento) {
      rotuloStatus = 'Em andamento';
      enfaseStatus = false;
    } else {
      rotuloStatus = 'Concluída';
      enfaseStatus = true;
    }

    return ListItemTile(
      titulo: cliente?.titulo ?? 'Cliente ${visita.clienteId}',
      subtitulo: 'Check-in ${formatarDataHora(visita.checkinEm)}',
      tag: AppBadge(texto: rotuloStatus, enfase: enfaseStatus),
      onTap: cliente == null
          ? null
          : () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => ClienteDetalheScreen(id: cliente!.id))),
    );
  }
}
