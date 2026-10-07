import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../theme/app_colors.dart';

/// Mapa do popup de endereço (flutter_map + OpenStreetMap - o mesmo do mapa
/// da carteira, sem chave de API): toque no mapa pra marcar o ponto. O
/// pino vira a localização do cliente (usada na validação de check-in de
/// visita). Move a câmera quando o ponto muda de fora ("Localizar").
class MapaEndereco extends StatefulWidget {
  const MapaEndereco({
    super.key,
    required this.latitude,
    required this.longitude,
    required this.aoEscolher,
  });

  final double? latitude;
  final double? longitude;
  final void Function(double latitude, double longitude) aoEscolher;

  @override
  State<MapaEndereco> createState() => _MapaEnderecoState();
}

class _MapaEnderecoState extends State<MapaEndereco> {
  // Centro geográfico do Brasil - fallback sem ponto definido.
  static const _centroPadrao = LatLng(-14.235, -51.9253);
  final _controller = MapController();

  LatLng? get _ponto => widget.latitude != null && widget.longitude != null
      ? LatLng(widget.latitude!, widget.longitude!)
      : null;

  @override
  void didUpdateWidget(MapaEndereco antigo) {
    super.didUpdateWidget(antigo);
    final ponto = _ponto;
    if (ponto != null && (antigo.latitude != widget.latitude || antigo.longitude != widget.longitude)) {
      try {
        _controller.move(ponto, math.max(_controller.camera.zoom, 16));
      } catch (_) {
        // Mapa ainda não montou - o centro inicial já usa o ponto.
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ponto = _ponto;
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: FlutterMap(
        mapController: _controller,
        options: MapOptions(
          initialCenter: ponto ?? _centroPadrao,
          initialZoom: ponto != null ? 16 : 4,
          onTap: (_, local) => widget.aoEscolher(local.latitude, local.longitude),
        ),
        children: [
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'br.com.copperline.copperline_mobile',
          ),
          if (ponto != null)
            MarkerLayer(
              markers: [
                Marker(
                  point: ponto,
                  width: 40,
                  height: 40,
                  alignment: Alignment.topCenter,
                  child: const Icon(Icons.location_on, size: 40, color: AppColors.red),
                ),
              ],
            ),
          const SimpleAttributionWidget(source: Text('OpenStreetMap')),
        ],
      ),
    );
  }
}
