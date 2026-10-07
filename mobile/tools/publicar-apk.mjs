#!/usr/bin/env node
// Gera o APK de release do app e o publica pro backend servir (o app se atualiza
// sozinho a partir dele - ver backend/src/app-versao e mobile/lib/core/atualizacao).
//
//   node tools/publicar-apk.mjs                  # builda a versao atual do pubspec
//   node tools/publicar-apk.mjs --bump           # incrementa o numero do build (+N)
//   node tools/publicar-apk.mjs --bump --notas "Cadastro de cliente e correcoes"
//
// O numero depois do "+" em `version: x.y.z+N` (pubspec.yaml) e o versionCode do
// Android: o app so se atualiza se o N publicado for MAIOR que o instalado.
//
// Saida em <raiz do repo>/app-releases/android/ (ignorada pelo git, e montada
// no container do backend em modo leitura):
//   copperline-<N>.apk   e   latest.json  (versao, sha256, tamanho, notas)

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobile = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raiz = resolve(mobile, '..');
const pubspec = join(mobile, 'pubspec.yaml');
const destino = join(raiz, 'app-releases', 'android');

function falhar(mensagem) {
  console.error(`\nERRO: ${mensagem}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const bump = args.includes('--bump');
const indiceNotas = args.indexOf('--notas');
const notas = indiceNotas >= 0 ? (args[indiceNotas + 1] ?? '') : '';

// A chave de release e' obrigatoria aqui: o Gradle cai na chave de debug sem
// ela, e um APK assinado com a chave errada NAO atualiza os celulares.
if (!existsSync(join(mobile, 'android', 'key.properties'))) {
  falhar(
    'android/key.properties nao encontrado - sem a chave de release o APK sairia ' +
      'assinado com a chave de debug e nao atualizaria os celulares ja instalados.',
  );
}

let texto = readFileSync(pubspec, 'utf8');
const versao = /^version:\s*(\d+\.\d+\.\d+)\+(\d+)\s*$/m.exec(texto);
if (!versao) falhar('nao achei "version: x.y.z+N" no pubspec.yaml.');
const nome = versao[1];
let build = Number(versao[2]);

if (bump) {
  build += 1;
  texto = texto.replace(versao[0], `version: ${nome}+${build}`);
  writeFileSync(pubspec, texto);
  console.log(`Versao do pubspec: ${nome}+${build}`);
}

console.log(`\nBuildando ${nome}+${build} (arm64, release)...\n`);
// Um APK so, arm64: com --split-per-abi o Flutter soma 1000*ABI ao versionCode
// (arm64 viraria 2000+N) e a comparacao de versao no app deixaria de bater. Os
// celulares de hoje sao 64 bits; 32 bits (armeabi-v7a) nao instalam este APK.
const build_ = spawnSync(
  'flutter',
  ['build', 'apk', '--release', '--target-platform', 'android-arm64'],
  { cwd: mobile, stdio: 'inherit', shell: true },
);
if (build_.status !== 0) falhar('flutter build apk falhou.');

const gerado = join(mobile, 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk');
if (!existsSync(gerado)) falhar(`APK nao encontrado em ${gerado}.`);

mkdirSync(destino, { recursive: true });
const arquivo = `copperline-${build}.apk`;
copyFileSync(gerado, join(destino, arquivo));

const apk = readFileSync(join(destino, arquivo));
const manifesto = {
  plataforma: 'android',
  versionCode: build,
  versionName: nome,
  arquivo,
  sha256: createHash('sha256').update(apk).digest('hex'),
  tamanhoBytes: statSync(join(destino, arquivo)).size,
  notas,
  publicadoEm: new Date().toISOString(),
};
// Escrita atomica: o backend le este arquivo a cada consulta; nunca pode pegar
// um JSON pela metade.
const temporario = join(destino, 'latest.json.tmp');
writeFileSync(temporario, `${JSON.stringify(manifesto, null, 2)}\n`);
renameSync(temporario, join(destino, 'latest.json'));

console.log(
  `\nPublicado: ${arquivo} (${(manifesto.tamanhoBytes / 1048576).toFixed(1)} MB)\n` +
    `sha256 ${manifesto.sha256}\n` +
    `-> ${destino}\n\n` +
    'Os celulares com versao menor passam a ser obrigados a atualizar no proximo login/abertura.',
);
