import 'dart:io';
import 'package:crypto/crypto.dart';
import '../api_exception.dart';
import 'notas_versao.dart';

/// Versão mais nova publicada no backend (GET /app/versao/android) - mesmo
/// shape de `backend/src/app-versao/app-versao.service.ts`.
class AtualizacaoApp {
  const AtualizacaoApp({
    required this.versionCode,
    required this.versionName,
    required this.sha256,
    required this.tamanhoBytes,
    required this.notas,
  });

  factory AtualizacaoApp.fromJson(Map<String, dynamic> json) => AtualizacaoApp(
    versionCode: json['versionCode'] as int,
    versionName: json['versionName'] as String,
    sha256: json['sha256'] as String,
    tamanhoBytes: json['tamanhoBytes'] as int,
    notas: json['notas'] as String? ?? '',
  );

  final int versionCode;
  final String versionName;
  final String sha256;
  final int tamanhoBytes;
  final String notas;

  String get tamanhoFormatado => '${(tamanhoBytes / 1048576).toStringAsFixed(1)} MB';
}

/// O app só é obrigado a atualizar se o que está publicado for MAIOR que o
/// instalado (o número depois do "+" do pubspec, que é o versionCode do
/// Android). Igual ou menor (ex: build local mais novo que o publicado) não
/// bloqueia nada.
bool precisaAtualizar({required int instalado, required int publicado}) => publicado > instalado;

/// O APK baixado não bateu com o SHA-256 publicado (corrompido ou trocado no
/// caminho) - nunca é aberto no instalador.
class ApkCorrompidoException implements Exception {
  const ApkCorrompidoException();

  @override
  String toString() => 'O arquivo baixado está corrompido. Tente novamente.';
}

/// Consulta, baixa e instala a atualização do próprio app, sem Play Store. As
/// pontas que dependem de plataforma (HTTP, disco, versão instalada, instalador
/// do Android) entram por construtor, pra a lógica ser testável sem celular.
class AtualizacaoAppService {
  AtualizacaoAppService({
    required this.buscarVersao,
    required this.baixar,
    required this.abrirInstalador,
    required this.versaoInstalada,
    required this.pastaDeDownload,
    required this.notasStore,
  });

  /// GET /app/versao/android -> JSON, ou null se nada foi publicado (404). Recebe
  /// o versionCode instalado só pra o servidor registrar quem roda o quê.
  final Future<Map<String, dynamic>?> Function(int instalada) buscarVersao;

  /// GET /app/versao/android/apk gravado em `destino`.
  final Future<void> Function(String destino, void Function(int, int) aoProgredir) baixar;

  /// Abre o instalador do Android com o APK (o usuário confirma a instalação).
  final Future<void> Function(String caminhoApk) abrirInstalador;

  /// versionCode do app instalado.
  final Future<int> Function() versaoInstalada;
  final Future<Directory> Function() pastaDeDownload;
  final NotasVersaoStore notasStore;

  /// Versão publicada, se for MAIS NOVA que a instalada. Qualquer falha (sem
  /// rede, servidor fora, manifesto ruim) vira null: o app é offline-first e
  /// NUNCA pode ser bloqueado por não conseguir conferir a versão - só por uma
  /// versão nova que ele CONSEGUIU confirmar que existe.
  Future<AtualizacaoApp?> verificar() async {
    try {
      final instalado = await versaoInstalada();
      final json = await buscarVersao(instalado);
      if (json == null) return null;
      final publicada = AtualizacaoApp.fromJson(json);
      return precisaAtualizar(instalado: instalado, publicado: publicada.versionCode)
          ? publicada
          : null;
    } on ApiException {
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Baixa o APK, confere o SHA-256 e abre o instalador. Erros sobem pra tela
  /// mostrar e deixar o usuário tentar de novo.
  Future<void> baixarEInstalar(
    AtualizacaoApp atualizacao,
    void Function(double progresso) aoProgredir,
  ) async {
    final pasta = await pastaDeDownload();
    await pasta.create(recursive: true);
    final arquivo = File('${pasta.path}${Platform.pathSeparator}copperline-${atualizacao.versionCode}.apk');
    if (await arquivo.exists()) await arquivo.delete();

    await baixar(arquivo.path, (recebidos, total) {
      // `total` pode vir -1 (servidor sem Content-Length): usa o tamanho publicado.
      final esperado = total > 0 ? total : atualizacao.tamanhoBytes;
      aoProgredir(esperado > 0 ? (recebidos / esperado).clamp(0.0, 1.0) : 0.0);
    });

    final hash = (await sha256.bind(arquivo.openRead()).first).toString();
    if (hash != atualizacao.sha256) {
      await arquivo.delete();
      throw const ApkCorrompidoException();
    }
    // Guarda as notas ANTES de abrir o instalador: depois de instalar o processo
    // é reiniciado e esta é a única chance de levá-las pra versão nova. Se o
    // usuário cancelar a instalação, não faz mal - as notas são de uma versão
    // (versionCode) e só valem quando o app instalado for exatamente essa.
    await notasStore.salvar(
      NotasVersao(
        versionCode: atualizacao.versionCode,
        versionName: atualizacao.versionName,
        notas: atualizacao.notas,
      ),
    );
    await abrirInstalador(arquivo.path);
  }

  /// Novidades da versão que está rodando, SE ainda não foram mostradas: só
  /// aparecem na primeira abertura depois de atualizar (e só se a versão
  /// instalada for a das notas guardadas e tiver texto).
  Future<NotasVersao?> novidadesParaMostrar() async {
    try {
      final instalada = await versaoInstalada();
      final notas = await notasStore.ler();
      if (notas == null || notas.versionCode != instalada || !notas.temTexto) return null;
      return await notasStore.versaoJaVista() >= instalada ? null : notas;
    } catch (_) {
      return null;
    }
  }

  Future<void> marcarNovidadesVistas(int versionCode) => notasStore.marcarComoVista(versionCode);

  /// Notas da versão instalada, pra tela "Sobre o app": primeiro as guardadas
  /// na atualização; senão (app instalado direto do APK) as do servidor, se o
  /// publicado for exatamente a versão instalada. Sem nenhuma, null.
  Future<NotasVersao?> notasDaVersaoInstalada() async {
    try {
      final instalada = await versaoInstalada();
      final guardadas = await notasStore.ler();
      if (guardadas != null && guardadas.versionCode == instalada) return guardadas;
      final json = await buscarVersao(instalada);
      if (json == null) return null;
      final publicada = AtualizacaoApp.fromJson(json);
      if (publicada.versionCode != instalada) return null;
      return NotasVersao(
        versionCode: publicada.versionCode,
        versionName: publicada.versionName,
        notas: publicada.notas,
      );
    } catch (_) {
      return null;
    }
  }
}
