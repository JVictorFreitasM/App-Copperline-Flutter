/// Mesmo shape de `backend/src/clientes/cliente-resumo-llm.service.ts`
/// (ClienteResumoLlmDto, GET /clientes/:id/resumo, OS-BACKEND-20).
class ClienteResumoLlm {
  const ClienteResumoLlm({
    required this.clienteId,
    required this.geradoEm,
    required this.pontosDeAtencao,
    required this.sugestaoAbordagem,
    required this.dadosInsuficientes,
    required this.fonteCache,
  });

  factory ClienteResumoLlm.fromJson(Map<String, dynamic> json) {
    return ClienteResumoLlm(
      clienteId: json['clienteId'] as String,
      geradoEm: json['geradoEm'] as String,
      pontosDeAtencao: (json['pontosDeAtencao'] as List).cast<String>(),
      sugestaoAbordagem: json['sugestaoAbordagem'] as String,
      dadosInsuficientes: json['dadosInsuficientes'] as bool,
      fonteCache: json['fonteCache'] as bool,
    );
  }

  final String clienteId;
  final String geradoEm;
  final List<String> pontosDeAtencao;
  final String sugestaoAbordagem;
  // Valvula de escape explicita contra alucinacao (ver comentario no
  // backend, ClienteResumoLlmService) - true quando o proprio modelo
  // reportou nao ter dado suficiente pra concluir algo.
  final bool dadosInsuficientes;
  final bool fonteCache;
}
