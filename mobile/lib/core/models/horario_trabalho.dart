/// Mesmo shape de
/// `backend/src/configuracoes/vendedor-horario-trabalho.service.ts`
/// (HorarioTrabalhoDto, GET/PATCH /vendedores/me/horario-trabalho) -
/// Épico 4 (config-aba-rastreio.jpg, "Desabilitar edição de horário de
/// trabalho no Android").
class HorarioTrabalho {
  const HorarioTrabalho({
    required this.horarioInicioTrabalho,
    required this.horarioFimTrabalho,
    required this.edicaoDesabilitada,
  });

  factory HorarioTrabalho.fromJson(Map<String, dynamic> json) {
    return HorarioTrabalho(
      horarioInicioTrabalho: json['horarioInicioTrabalho'] as String?,
      horarioFimTrabalho: json['horarioFimTrabalho'] as String?,
      edicaoDesabilitada: json['edicaoDesabilitada'] as bool,
    );
  }

  // null = sem customizacao, o rastreio usa o horario GLOBAL da config
  // (ConfiguracaoRastreio.horarioInicio/TerminoRastreamento).
  final String? horarioInicioTrabalho;
  final String? horarioFimTrabalho;
  final bool edicaoDesabilitada;
}
