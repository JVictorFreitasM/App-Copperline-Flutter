import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/models/cadastro_cliente.dart';
import '../core/models/documento_brasileiro.dart';
import '../core/providers/cadastro_cliente_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/cadastro_cliente/mapa_endereco.dart';
import '../widgets/cadastro_cliente/mascara_formatter.dart';

/// "Cadastrar endereço" (cobrança/entrega) da tela de referência, como tela
/// cheia (no celular um popup com mapa não cabe): o CEP preenche
/// logradouro/bairro/cidade/UF sozinho (consulta cacheada no backend) e o
/// mapa marca o ponto - "Localizar" acha o endereço e o toque no mapa ajusta.
/// Devolve o [EnderecoFormulario] ao salvar (ou nada, se cancelar).
class EnderecoFormScreen extends ConsumerStatefulWidget {
  const EnderecoFormScreen({super.key, this.inicial});

  final EnderecoFormulario? inicial;

  @override
  ConsumerState<EnderecoFormScreen> createState() => _EnderecoFormScreenState();
}

class _EnderecoFormScreenState extends ConsumerState<EnderecoFormScreen> {
  late EnderecoFormulario _endereco = widget.inicial ?? const EnderecoFormulario();
  final _cep = TextEditingController();
  final _logradouro = TextEditingController();
  final _numero = TextEditingController();
  final _complemento = TextEditingController();
  final _bairro = TextEditingController();
  final _cidade = TextEditingController();
  final _uf = TextEditingController();

  bool _buscandoCep = false;
  bool _localizando = false;
  String? _erro;
  // Ignora resposta de CEP que chegou depois de o usuário já ter mudado o CEP.
  String? _cepEmBusca;

  @override
  void initState() {
    super.initState();
    _preencherCampos();
  }

  void _preencherCampos() {
    _cep.text = formatarCep(_endereco.cep);
    _logradouro.text = _endereco.logradouro;
    _numero.text = _endereco.numero;
    _complemento.text = _endereco.complemento;
    _bairro.text = _endereco.bairro;
    _cidade.text = _endereco.cidade;
    _uf.text = _endereco.uf;
  }

  @override
  void dispose() {
    for (final c in [_cep, _logradouro, _numero, _complemento, _bairro, _cidade, _uf]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Lê os campos de volta pro modelo (a fonte da verdade é o que está na tela).
  EnderecoFormulario _doFormulario() => _endereco.copiarCom(
    cep: _cep.text,
    logradouro: _logradouro.text,
    numero: _numero.text,
    complemento: _complemento.text,
    bairro: _bairro.text,
    cidade: _cidade.text,
    uf: _uf.text.toUpperCase(),
  );

  Future<void> _aoMudarCep(String valor) async {
    final digitos = normalizarCep(valor);
    if (digitos.length < 8) {
      _cepEmBusca = null;
      return;
    }
    _cepEmBusca = digitos;
    setState(() {
      _buscandoCep = true;
      _erro = null;
    });
    final resultado = await ref.read(cadastroClienteServiceProvider).buscarCep(digitos);
    if (!mounted || _cepEmBusca != digitos) return;
    setState(() => _buscandoCep = false);

    switch (resultado) {
      case CepEncontrado(:final cep):
        setState(() {
          if (cep.logradouro != null) _logradouro.text = cep.logradouro!;
          if (cep.bairro != null) _bairro.text = cep.bairro!;
          if (_complemento.text.isEmpty && cep.complemento != null) {
            _complemento.text = cep.complemento!;
          }
          if (cep.localidade != null) _cidade.text = cep.localidade!;
          if (cep.uf != null) _uf.text = cep.uf!;
          _endereco = _doFormulario().copiarCom(codigoIbge: cep.codigoIbge);
        });
      case CepNaoEncontrado():
        setState(() {
          _endereco = _doFormulario().copiarCom(limparCodigoIbge: true);
          _erro = 'CEP não encontrado - preencha o endereço manualmente.';
        });
      case CepErro(:final mensagem):
        setState(() => _erro = mensagem);
    }
  }

  Future<void> _localizar() async {
    final consultas = _doFormulario().consultasDeLocalizacao;
    if (consultas.isEmpty) {
      setState(() => _erro = 'Preencha o CEP ou o logradouro para localizar no mapa.');
      return;
    }
    setState(() {
      _localizando = true;
      _erro = null;
    });
    final resultado = await ref.read(cadastroClienteServiceProvider).localizar(consultas);
    if (!mounted) return;
    setState(() {
      _localizando = false;
      switch (resultado) {
        case LocalizacaoEncontrada(:final local):
          _endereco = _doFormulario().copiarCom(latitude: local.latitude, longitude: local.longitude);
        case LocalizacaoNaoEncontrada():
          _erro = 'Não foi possível achar o endereço no mapa - toque no mapa para marcar o ponto.';
        case LocalizacaoErro(:final mensagem):
          _erro = mensagem;
      }
    });
  }

  void _limpar() {
    _cepEmBusca = null;
    setState(() {
      _endereco = const EnderecoFormulario();
      _erro = null;
      _preencherCampos();
    });
  }

  void _salvar() {
    final endereco = _doFormulario();
    if (!endereco.completo) {
      setState(() => _erro = 'Informe CEP (8 dígitos), logradouro, número (ou marque sem número) e bairro.');
      return;
    }
    if (endereco.cidade.trim().isEmpty || !RegExp(r'^[A-Za-z]{2}$').hasMatch(endereco.uf.trim())) {
      setState(() => _erro = 'Informe a cidade e o estado (UF com 2 letras).');
      return;
    }
    Navigator.of(context).pop(endereco);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cadastrar endereço')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            TextField(
              controller: _cep,
              keyboardType: TextInputType.number,
              inputFormatters: const [MascaraFormatter(formatarCep)],
              onChanged: _aoMudarCep,
              decoration: InputDecoration(
                labelText: _buscandoCep ? 'CEP (consultando...)' : 'CEP',
                hintText: '00000-000',
              ),
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: TextField(
                    controller: _logradouro,
                    maxLength: 84,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(labelText: 'Logradouro', counterText: ''),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  width: 96,
                  child: TextField(
                    controller: _numero,
                    enabled: !_endereco.semNumero,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(labelText: 'Número'),
                  ),
                ),
              ],
            ),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              dense: true,
              title: const Text('Sem número'),
              value: _endereco.semNumero,
              onChanged: (marcado) => setState(() {
                _endereco = _doFormulario().copiarCom(semNumero: marcado ?? false);
                if (marcado ?? false) _numero.clear();
              }),
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: TextField(
                    controller: _complemento,
                    maxLength: 60,
                    decoration: const InputDecoration(labelText: 'Complemento', counterText: ''),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _bairro,
                    maxLength: 60,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(labelText: 'Bairro', counterText: ''),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _cidade,
                    decoration: const InputDecoration(labelText: 'Cidade'),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  width: 72,
                  child: TextField(
                    controller: _uf,
                    maxLength: 2,
                    textCapitalization: TextCapitalization.characters,
                    inputFormatters: [FilteringTextInputFormatter.allow(RegExp('[A-Za-z]'))],
                    decoration: const InputDecoration(labelText: 'UF', counterText: ''),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text('País: Brasil', style: TextStyle(fontSize: 12, color: AppColors.muted)),
            const SizedBox(height: 14),
            SizedBox(
              height: 260,
              child: MapaEndereco(
                latitude: _endereco.latitude,
                longitude: _endereco.longitude,
                aoEscolher: (lat, lng) =>
                    setState(() => _endereco = _doFormulario().copiarCom(latitude: lat, longitude: lng)),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Toque no mapa para ajustar o ponto - ele vira a localização do cliente.',
              style: TextStyle(fontSize: 12, color: AppColors.muted),
            ),
            if (_erro != null) ...[
              const SizedBox(height: 10),
              Text(_erro!, style: const TextStyle(fontSize: 12, color: AppColors.red)),
            ],
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: _localizando ? null : _localizar,
                  icon: const Icon(Icons.my_location, size: 16),
                  label: Text(_localizando ? 'Localizando...' : 'Localizar'),
                ),
                OutlinedButton.icon(
                  onPressed: _limpar,
                  icon: const Icon(Icons.delete_outline, size: 16),
                  label: const Text('Limpar'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Cancelar'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(child: FilledButton(onPressed: _salvar, child: const Text('Salvar'))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
