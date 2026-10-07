import 'dart:io';
import 'package:crypto/crypto.dart';
import '../api_exception.dart';

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
  });

  /// GET /app/versao/android -> JSON, ou null se nada foi publicado (404).
  final Future<Map<String, dynamic>?> Function() buscarVersao;

  /// GET /app/versao/android/apk gravado em `destino`.
  final Future<void> Function(String destino, void Function(int, int) aoProgredir) baixar;

  /// Abre o instalador do Android com o APK (o usuário confirma a instalação).
  final Future<void> Function(String caminhoApk) abrirInstalador;

  /// versionCode do app instalado.
  final Future<int> Function() versaoInstalada;
  final Future<Directory> Function() pastaDeDownload;

  /// Versão publicada, se for MAIS NOVA que a instalada. Qualquer falha (sem
  /// rede, servidor fora, manifesto ruim) vira null: o app é offline-first e
  /// NUNCA pode ser bloqueado por não conseguir conferir a versão - só por uma
  /// versão nova que ele CONSEGUIU confirmar que existe.
  Future<AtualizacaoApp?> verificar() async {
    try {
      final json = await buscarVersao();
      if (json == null) return null;
      final publicada = AtualizacaoApp.fromJson(json);
      final instalado = await versaoInstalada();
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
    await abrirInstalador(arquivo.path);
  }
}
