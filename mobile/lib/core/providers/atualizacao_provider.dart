import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import '../api_client.dart';
import '../api_exception.dart';
import '../atualizacao/atualizacao_app.dart';

const _tipoApk = 'application/vnd.android.package-archive';

final atualizacaoAppServiceProvider = Provider<AtualizacaoAppService>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return AtualizacaoAppService(
    buscarVersao: () async {
      try {
        return await apiClient.getJson('/app/versao/android');
      } on ApiException catch (erro) {
        // 404 = nada publicado ainda: não é falha, é "sem atualização".
        if (erro.statusCode == 404) return null;
        rethrow;
      }
    },
    baixar: (destino, aoProgredir) =>
        apiClient.baixarArquivo('/app/versao/android/apk', destino, aoProgredir: aoProgredir),
    abrirInstalador: (caminho) async {
      final resultado = await OpenFilex.open(caminho, type: _tipoApk);
      if (resultado.type != ResultType.done) {
        throw StateError(
          'Não foi possível abrir o instalador. Permita "instalar apps desta fonte" nas '
          'configurações do Android e toque em Atualizar de novo. (${resultado.message})',
        );
      }
    },
    // No Android o "buildNumber" é o versionCode (o N depois do "+" do pubspec).
    versaoInstalada: () async => int.parse((await PackageInfo.fromPlatform()).buildNumber),
    // Pasta própria do app (sem permissão de armazenamento); cai no cache se
    // o aparelho não tiver armazenamento externo.
    pastaDeDownload: () async {
      final externa = await getExternalStorageDirectory();
      return Directory('${(externa ?? await getTemporaryDirectory()).path}/atualizacao');
    },
  );
});

/// Versão mais nova publicada, se for maior que a instalada - null = nada a
/// fazer (inclusive sem rede: o app nunca é bloqueado por não conseguir
/// conferir). Só há atualização própria no Android.
final atualizacaoAppProvider = FutureProvider<AtualizacaoApp?>((ref) async {
  if (!Platform.isAndroid) return null;
  return ref.watch(atualizacaoAppServiceProvider).verificar();
});
