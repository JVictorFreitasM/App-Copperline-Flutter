import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../api_exception.dart';
import '../models/cadastro_cliente.dart';
import '../models/documento_brasileiro.dart';

/// Resultado de consultar um CPF/CNPJ digitado no cadastro - um caso por
/// situação possível (mesmo desenho do `ResultadoDocumento` do web).
sealed class ResultadoDocumento {
  const ResultadoDocumento();
}

/// CNPJ livre: dados da Receita (ou do cache) e endereço sugerido.
class DocumentoCnpj extends ResultadoDocumento {
  const DocumentoCnpj(this.resultado);
  final ConsultaCnpjResultado resultado;
}

/// CPF disponível - não há consulta pública de CPF, só se checa a base.
class DocumentoCpfLivre extends ResultadoDocumento {
  const DocumentoCpfLivre();
}

class DocumentoJaCadastrado extends ResultadoDocumento {
  const DocumentoJaCadastrado(this.cliente);
  final ClienteJaCadastrado cliente;
}

class DocumentoInvalido extends ResultadoDocumento {
  const DocumentoInvalido();
}

/// CNPJ que a Receita não conhece - segue manual.
class DocumentoNaoEncontrado extends ResultadoDocumento {
  const DocumentoNaoEncontrado(this.mensagem);
  final String mensagem;
}

/// Falha de rede, limite de consultas ou erro do servidor - dá pra tentar
/// de novo.
class DocumentoErro extends ResultadoDocumento {
  const DocumentoErro(this.mensagem);
  final String mensagem;
}

sealed class ResultadoCep {
  const ResultadoCep();
}

class CepEncontrado extends ResultadoCep {
  const CepEncontrado(this.cep);
  final ConsultaCep cep;
}

class CepNaoEncontrado extends ResultadoCep {
  const CepNaoEncontrado();
}

class CepErro extends ResultadoCep {
  const CepErro(this.mensagem);
  final String mensagem;
}

sealed class ResultadoLocalizacao {
  const ResultadoLocalizacao();
}

class LocalizacaoEncontrada extends ResultadoLocalizacao {
  const LocalizacaoEncontrada(this.local);
  final Geocodificacao local;
}

class LocalizacaoNaoEncontrada extends ResultadoLocalizacao {
  const LocalizacaoNaoEncontrada();
}

class LocalizacaoErro extends ResultadoLocalizacao {
  const LocalizacaoErro(this.mensagem);
  final String mensagem;
}

/// Chamadas do cadastro/edição de cliente. Tudo passa pelo backend NestJS -
/// o app nunca fala direto com Receita, API de CEP nem serviço de mapas (token
/// e limites de cada provedor ficam no servidor, com cache).
class CadastroClienteService {
  CadastroClienteService(this._apiClient);

  final ApiClient _apiClient;

  String _mensagem(Object erro) => erro is ApiException ? erro.message : '$erro';

  /// Valida por cálculo ANTES de qualquer chamada (CNPJ inválido nem sai do
  /// aparelho). CNPJ: o backend checa a base da empresa, depois o cache e só
  /// então a Receita. CPF: só a base.
  Future<ResultadoDocumento> consultarDocumento(String entrada) async {
    final tipo = tipoPessoaDoDocumento(entrada);
    if (tipo == null) return const DocumentoInvalido();
    final documento = normalizarDocumento(entrada);

    try {
      if (tipo == TipoPessoa.fisica) {
        final json = await _apiClient.getJson(
          '/clientes/verificar-conflito?documento=${Uri.encodeQueryComponent(documento)}',
        );
        return json['existe'] == true
            ? DocumentoJaCadastrado(
                ClienteJaCadastrado(vendedorResponsavel: json['vendedorResponsavel'] as String?),
              )
            : const DocumentoCpfLivre();
      }

      final json = await _apiClient.getJson('/consulta-cnpj/${Uri.encodeComponent(documento)}');
      final resultado = ConsultaCnpjResultado.fromJson(json);
      return resultado.jaCadastrado != null
          ? DocumentoJaCadastrado(resultado.jaCadastrado!)
          : DocumentoCnpj(resultado);
    } on ApiException catch (erro) {
      if (erro.statusCode == 404) {
        return const DocumentoNaoEncontrado(
          'CNPJ não encontrado na Receita Federal - preencha manualmente.',
        );
      }
      if (erro.statusCode == 429) {
        return const DocumentoErro('Muitas consultas seguidas. Aguarde alguns instantes.');
      }
      return DocumentoErro(erro.message);
    }
  }

  Future<ResultadoCep> buscarCep(String entrada) async {
    if (!cepEhValido(entrada)) return const CepErro('CEP inválido.');
    try {
      final json = await _apiClient.getJson('/consulta-cep/${normalizarCep(entrada)}');
      return CepEncontrado(ConsultaCep.fromJson(json));
    } on ApiException catch (erro) {
      return erro.statusCode == 404 ? const CepNaoEncontrado() : CepErro(erro.message);
    }
  }

  /// "Localizar": tenta cada texto (do mais específico pro mais geral) até o
  /// mapa achar. Cada tentativa passa pelo backend (cache + limite de 1 req/s
  /// do Nominatim).
  Future<ResultadoLocalizacao> localizar(List<String> consultas) async {
    for (final consulta in consultas.take(3)) {
      try {
        final json = await _apiClient.getJson(
          '/geocodificacao?q=${Uri.encodeQueryComponent(consulta)}',
        );
        return LocalizacaoEncontrada(Geocodificacao.fromJson(json));
      } on ApiException catch (erro) {
        if (erro.statusCode == 404) continue;
        return LocalizacaoErro(erro.message);
      }
    }
    return const LocalizacaoNaoEncontrada();
  }

  /// POST /clientes. Erro de negócio (documento duplicado, município não
  /// identificado, contato faltando) sobe como [ApiException] com a mensagem
  /// do servidor - a tela mostra como está.
  Future<ClienteCriado> criar(Map<String, dynamic> payload) async {
    final json = await _apiClient.postJson('/clientes', payload);
    return ClienteCriado.fromJson(json);
  }

  Future<ClienteEdicao> obterParaEdicao(String clienteId) async {
    final json = await _apiClient.getJson('/clientes/${Uri.encodeComponent(clienteId)}/edicao');
    return ClienteEdicao.fromJson(json);
  }

  /// PATCH /clientes/:id - devolve a situação (`SEM_ALTERACAO`,
  /// `CADASTRO_PENDENTE` ou `ALTERACAO_PENDENTE`).
  Future<String> atualizar(String clienteId, Map<String, dynamic> payload) async {
    final json = await _apiClient.patchJson('/clientes/${Uri.encodeComponent(clienteId)}', payload);
    return json['situacao'] as String? ?? 'ALTERACAO_PENDENTE';
  }

  /// Mensagem pronta pra mostrar quando uma chamada de gravação falha.
  String mensagemDeErro(Object erro) => _mensagem(erro);
}

final cadastroClienteServiceProvider = Provider<CadastroClienteService>((ref) {
  return CadastroClienteService(ref.watch(apiClientProvider));
});
