/// Mesmo shape de `backend/src/mobile/mobile-snapshot.service.ts`
/// (ConfiguracaoRastreioParaMobileDto, dentro de GET /mobile/snapshot) -
/// Épico 4 (config-aba-rastreio.jpg). O backend continua sendo a fonte de
/// verdade pra tudo que é validado no servidor (distância/precisão) -
/// os valores aqui servem pra pré-check de UX (feedback imediato) e pra
/// decidir quando o app deve capturar um ponto de rastreio.
class ConfiguracaoRastreio {
  const ConfiguracaoRastreio({
    required this.desabilitarEdicaoHorarioTrabalhoAndroid,
    required this.habilitarRastreamentoSabados,
    required this.habilitarRastreamentoDomingos,
    required this.horarioInicioRastreamento,
    required this.horarioTerminoRastreamento,
    required this.precisaoMinimaMetrosGps,
    required this.tempoMinimoAcordarGpsMs,
    required this.permitirRegistroComGpsDesabilitado,
    required this.distanciaMaximaClienteRegistroPedidoMetros,
    required this.distanciaMaximaClienteRegistroVisitaMetros,
  });

  factory ConfiguracaoRastreio.fromJson(Map<String, dynamic> json) {
    return ConfiguracaoRastreio(
      desabilitarEdicaoHorarioTrabalhoAndroid:
          json['desabilitarEdicaoHorarioTrabalhoAndroid'] as bool,
      habilitarRastreamentoSabados: json['habilitarRastreamentoSabados'] as bool,
      habilitarRastreamentoDomingos: json['habilitarRastreamentoDomingos'] as bool,
      horarioInicioRastreamento: json['horarioInicioRastreamento'] as String,
      horarioTerminoRastreamento: json['horarioTerminoRastreamento'] as String,
      precisaoMinimaMetrosGps: (json['precisaoMinimaMetrosGps'] as num).toDouble(),
      tempoMinimoAcordarGpsMs: json['tempoMinimoAcordarGpsMs'] as int,
      permitirRegistroComGpsDesabilitado: json['permitirRegistroComGpsDesabilitado'] as bool,
      distanciaMaximaClienteRegistroPedidoMetros:
          (json['distanciaMaximaClienteRegistroPedidoMetros'] as num?)?.toDouble(),
      distanciaMaximaClienteRegistroVisitaMetros:
          (json['distanciaMaximaClienteRegistroVisitaMetros'] as num).toDouble(),
    );
  }

  // Default conservador (mesmo raio fixo de 50m que o app usava antes do
  // Épico 4) - usado só enquanto o snapshot ainda não baixou pela
  // primeira vez (nunca bloqueia a tela por falta de config).
  factory ConfiguracaoRastreio.padrao() => const ConfiguracaoRastreio(
    desabilitarEdicaoHorarioTrabalhoAndroid: true,
    habilitarRastreamentoSabados: false,
    habilitarRastreamentoDomingos: false,
    horarioInicioRastreamento: '07:30',
    horarioTerminoRastreamento: '18:00',
    precisaoMinimaMetrosGps: 50,
    tempoMinimoAcordarGpsMs: 60000,
    permitirRegistroComGpsDesabilitado: false,
    distanciaMaximaClienteRegistroPedidoMetros: null,
    distanciaMaximaClienteRegistroVisitaMetros: 50,
  );

  Map<String, dynamic> toJson() => {
    'desabilitarEdicaoHorarioTrabalhoAndroid': desabilitarEdicaoHorarioTrabalhoAndroid,
    'habilitarRastreamentoSabados': habilitarRastreamentoSabados,
    'habilitarRastreamentoDomingos': habilitarRastreamentoDomingos,
    'horarioInicioRastreamento': horarioInicioRastreamento,
    'horarioTerminoRastreamento': horarioTerminoRastreamento,
    'precisaoMinimaMetrosGps': precisaoMinimaMetrosGps,
    'tempoMinimoAcordarGpsMs': tempoMinimoAcordarGpsMs,
    'permitirRegistroComGpsDesabilitado': permitirRegistroComGpsDesabilitado,
    'distanciaMaximaClienteRegistroPedidoMetros': distanciaMaximaClienteRegistroPedidoMetros,
    'distanciaMaximaClienteRegistroVisitaMetros': distanciaMaximaClienteRegistroVisitaMetros,
  };

  final bool desabilitarEdicaoHorarioTrabalhoAndroid;
  final bool habilitarRastreamentoSabados;
  final bool habilitarRastreamentoDomingos;
  final String horarioInicioRastreamento;
  final String horarioTerminoRastreamento;
  final double precisaoMinimaMetrosGps;
  final int tempoMinimoAcordarGpsMs;
  final bool permitirRegistroComGpsDesabilitado;
  final double? distanciaMaximaClienteRegistroPedidoMetros;
  final double distanciaMaximaClienteRegistroVisitaMetros;

  /// Se `agora` cai dentro da janela de rastreio (dia da semana + horário)
  /// configurada. `horarioInicio`/`horarioTerminoOverride` (do vendedor,
  /// `Vendedor.horarioInicio/FimTrabalho`) têm prioridade sobre o horário
  /// GLOBAL desta config quando informados - mesma regra do backend
  /// (VendedorHorarioTrabalhoService, ver seu comentário).
  bool dentroDaJanela(DateTime agora, {String? horarioInicioOverride, String? horarioFimOverride}) {
    final diaSemana = agora.weekday; // 6 = sabado, 7 = domingo
    if (diaSemana == DateTime.saturday && !habilitarRastreamentoSabados) return false;
    if (diaSemana == DateTime.sunday && !habilitarRastreamentoDomingos) return false;

    final inicio = _parseHorario(horarioInicioOverride ?? horarioInicioRastreamento);
    final fim = _parseHorario(horarioFimOverride ?? horarioTerminoRastreamento);
    final minutosAgora = agora.hour * 60 + agora.minute;
    return minutosAgora >= inicio && minutosAgora <= fim;
  }

  static int _parseHorario(String horario) {
    final partes = horario.split(':');
    return int.parse(partes[0]) * 60 + int.parse(partes[1]);
  }
}
