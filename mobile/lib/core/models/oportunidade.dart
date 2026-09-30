/// Mesmo shape de `backend/src/oportunidades/domain/detectar-oportunidade.ts`
/// (MotivoOportunidade) e `oportunidade-cliente.service.ts`
/// (OportunidadeClienteDto) - duplicado aqui por não haver pacote
/// compartilhado entre mobile e back (mesmo padrão do web,
/// `frontend/src/lib/oportunidades.ts`).
class OportunidadeCliente {
  const OportunidadeCliente({
    required this.clienteId,
    required this.clienteNome,
    required this.motivo,
    required this.ultimaInteracaoEm,
    required this.contexto,
  });

  factory OportunidadeCliente.fromJson(Map<String, dynamic> json) {
    return OportunidadeCliente(
      clienteId: json['clienteId'] as String,
      clienteNome: json['clienteNome'] as String?,
      motivo: json['motivo'] as Map<String, dynamic>,
      ultimaInteracaoEm: json['ultimaInteracaoEm'] as String?,
      // null quando a geração por IA falhou (ex: sem chave configurada) - o
      // motivo estrutural continua válido e exibido, só a frase de
      // contexto fica ausente.
      contexto: json['contexto'] as String?,
    );
  }

  final String clienteId;
  final String? clienteNome;
  final Map<String, dynamic> motivo;
  final String? ultimaInteracaoEm;
  final String? contexto;
}

// Frase curta a partir do motivo ESTRUTURAL (regra determinística, nunca
// texto da IA) - sempre disponível, mesmo quando `contexto` (LLM) é null.
// Mesmo texto de rotuloMotivo() no web (frontend/src/lib/oportunidades.ts).
String rotuloMotivoOportunidade(Map<String, dynamic> motivo) {
  switch (motivo['tipo']) {
    case 'SEM_PEDIDO_HA_DIAS':
      return 'Sem pedido há ${motivo['dias']} dia(s)';
    case 'ANIVERSARIO_RELACIONAMENTO':
      return 'Aniversário de relacionamento (${motivo['anos']} ano(s))';
    case 'RECOMPRA_PROXIMA':
      return 'Recompra próxima (costuma comprar a cada ${motivo['intervaloMedioDias']} '
          'dia(s), última há ${motivo['diasDesdeUltimaCompra']})';
    default:
      return motivo['tipo'] as String? ?? '—';
  }
}
