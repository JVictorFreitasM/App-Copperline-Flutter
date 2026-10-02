import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_exception.dart';
import 'aprovacoes_provider.dart';
import 'clientes_provider.dart';
import 'notificacoes_provider.dart';
import 'offline_provider.dart';
import 'pagamento_provider.dart';
import 'pedidos_provider.dart';

/// Quanto de cada coisa já está salvo neste aparelho (pra tela de
/// sincronização - referência do que funciona sem internet).
class ResumoDadosLocais {
  const ResumoDadosLocais({
    this.clientes = 0,
    this.produtos = 0,
    this.tabelas = 0,
    this.precos = 0,
  });

  final int clientes;
  final int produtos;
  final int tabelas;
  final int precos;
}

class SincronizacaoEstado {
  const SincronizacaoEstado({
    this.sincronizando = false,
    this.ultimaSincronizacao,
    this.erro,
    this.dados = const ResumoDadosLocais(),
    this.pendentes = 0,
  });

  final bool sincronizando;

  /// Último download completo com sucesso (hora do servidor, no fuso local).
  final DateTime? ultimaSincronizacao;

  /// Mensagem da última tentativa que falhou (ex: sem conexão); null = ok.
  final String? erro;
  final ResumoDadosLocais dados;

  /// Ações offline (pedido, check-in...) aguardando envio.
  final int pendentes;

  SincronizacaoEstado copiar({
    bool? sincronizando,
    DateTime? ultimaSincronizacao,
    String? erro,
    bool limparErro = false,
    ResumoDadosLocais? dados,
    int? pendentes,
  }) {
    return SincronizacaoEstado(
      sincronizando: sincronizando ?? this.sincronizando,
      ultimaSincronizacao: ultimaSincronizacao ?? this.ultimaSincronizacao,
      erro: limparErro ? null : (erro ?? this.erro),
      dados: dados ?? this.dados,
      pendentes: pendentes ?? this.pendentes,
    );
  }
}

const _intervaloPeriodico = Duration(minutes: 30);
const _idadeMaximaAoVoltar = Duration(minutes: 10);

class _ObservadorCicloDeVida with WidgetsBindingObserver {
  _ObservadorCicloDeVida(this._aoVoltar);

  final VoidCallback _aoVoltar;

  @override
  void didChangeAppLifecycleState(AppLifecycleState estado) {
    if (estado == AppLifecycleState.resumed) _aoVoltar();
  }
}

/// Ponto ÚNICO de sincronização do app: envia o que ficou pendente offline e
/// baixa TUDO que precisa pra trabalhar sem internet - snapshot (clientes,
/// produtos, pedidos, estoque), carteira com detalhe, tabelas de preço de cada
/// cliente e catálogos de pagamento. Dispara sozinho ao entrar, quando a
/// conexão volta, ao voltar pro app e a cada 30 min; e manualmente pelo botão
/// de sincronização / puxando a tela.
class SincronizacaoNotifier extends Notifier<SincronizacaoEstado> {
  bool _semRede = false;

  @override
  SincronizacaoEstado build() {
    final observador = _ObservadorCicloDeVida(_aoVoltarParaOApp);
    WidgetsBinding.instance.addObserver(observador);
    final assinatura = Connectivity().onConnectivityChanged.listen(_aoMudarConectividade);
    final timer = Timer.periodic(_intervaloPeriodico, (_) => sincronizar());
    ref.onDispose(() {
      WidgetsBinding.instance.removeObserver(observador);
      assinatura.cancel();
      timer.cancel();
    });
    Future.microtask(_atualizarResumo);
    return const SincronizacaoEstado();
  }

  void _aoMudarConectividade(List<ConnectivityResult> resultados) {
    final semRede = resultados.every((r) => r == ConnectivityResult.none);
    if (_semRede && !semRede) {
      sincronizar();
    }
    _semRede = semRede;
  }

  // Voltou pro app (ex: o pedido foi aprovado no web enquanto o app estava em
  // segundo plano): as telas de pedido/aprovação/notificação recarregam sempre;
  // o download completo só se o último já está velho.
  void _aoVoltarParaOApp() {
    _recarregarTelas();
    final ultima = state.ultimaSincronizacao;
    if (ultima == null || DateTime.now().difference(ultima) > _idadeMaximaAoVoltar) {
      sincronizar();
    }
  }

  Future<void> sincronizar() async {
    if (state.sincronizando) return;
    state = state.copiar(sincronizando: true, limparErro: true);

    String? erro;
    var sucesso = false;
    try {
      // 1) envia o que ficou pendente (pedido/check-in feito offline)...
      final fila = await ref.read(filaPendenteServiceProvider.future);
      await fila.sincronizar();
      // 2) ...e baixa tudo: snapshot, carteira + tabelas de preço...
      final snapshot = await ref.read(snapshotServiceProvider.future);
      await snapshot.baixar();
      final dados = await ref.read(dadosComerciaisServiceProvider.future);
      await dados.baixar();
      // 3) ...e os catálogos do formulário de pedido.
      ref.invalidate(formasPagamentoProvider);
      ref.invalidate(condicoesPagamentoProvider);
      try {
        await ref.read(formasPagamentoProvider.future);
        await ref.read(condicoesPagamentoProvider.future);
      } catch (_) {
        // Catálogo é complemento - falha aqui não invalida o resto.
      }
      sucesso = true;
    } on ApiException catch (e) {
      erro = e.statusCode == null
          ? 'Sem conexão - usando os dados salvos neste aparelho.'
          : e.message;
    } catch (e) {
      erro = '$e';
    }

    await _atualizarResumo();
    _recarregarTelas();
    state = state.copiar(
      sincronizando: false,
      erro: erro,
      ultimaSincronizacao: sucesso ? DateTime.now() : null,
    );
  }

  Future<void> _atualizarResumo() async {
    try {
      final banco = await ref.read(localDatabaseProvider.future);
      final db = banco.db;
      Future<int> contar(String sql) async =>
          (await db.rawQuery(sql)).first.values.first as int? ?? 0;

      final dados = ResumoDadosLocais(
        clientes: await contar('SELECT COUNT(*) FROM clientes_detalhe'),
        produtos: await contar('SELECT COUNT(*) FROM produtos'),
        tabelas: await contar('SELECT COUNT(DISTINCT tabela) FROM tabelas_preco_itens'),
        precos: await contar('SELECT COUNT(*) FROM tabelas_preco_itens'),
      );
      final fila = await ref.read(filaPendenteServiceProvider.future);
      final pendentes = await fila.contarPendentes();

      DateTime? ultima;
      if (state.ultimaSincronizacao == null) {
        final servico = await ref.read(dadosComerciaisServiceProvider.future);
        final iso = await servico.geradoEm();
        ultima = iso == null ? null : DateTime.tryParse(iso)?.toLocal();
      }
      state = state.copiar(dados: dados, pendentes: pendentes, ultimaSincronizacao: ultima);
    } catch (_) {
      // Resumo é só informativo - nunca derruba a sincronização.
    }
  }

  // Faz as telas já abertas buscarem de novo (lista/detalhe de pedido,
  // aprovações, notificações...) em vez de mostrar o valor em cache.
  void recarregarTelas() => _recarregarTelas();

  void _recarregarTelas() {
    ref.invalidate(pedidosProvider);
    ref.invalidate(pedidoDetalheProvider);
    ref.invalidate(clientesProvider);
    ref.invalidate(clienteDetalheProvider);
    ref.invalidate(tabelasPrecoClienteProvider);
    ref.invalidate(produtosDoClienteProvider);
    ref.invalidate(solicitacoesPendentesProvider);
    ref.invalidate(notificacoesProvider);
    ref.invalidate(contagemNaoLidasProvider);
    ref.invalidate(contagemPendentesProvider);
    ref.invalidate(acoesPendentesPorTipoProvider);
    ref.invalidate(listaAcoesPendentesProvider);
  }
}

final sincronizacaoProvider = NotifierProvider<SincronizacaoNotifier, SincronizacaoEstado>(
  SincronizacaoNotifier.new,
);
