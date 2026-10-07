import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_exception.dart';
import '../core/models/cadastro_cliente.dart';
import '../core/models/documento_brasileiro.dart';
import '../core/providers/cadastro_cliente_provider.dart';
import '../core/providers/clientes_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_card.dart';
import '../widgets/cadastro_cliente/campo_telefones.dart';
import '../widgets/cadastro_cliente/mascara_formatter.dart';
import '../widgets/cadastro_cliente/seletor_endereco.dart';
import '../widgets/listagem_feedback.dart';
import 'contato_form_screen.dart';
import 'endereco_form_screen.dart';

enum _SituacaoDocumento { ocioso, consultando, ok, aviso, jaCadastrado, erro }

/// Cadastro (e edição) de cliente. Sem [clienteId] é cadastro: ao completar o
/// CPF/CNPJ valida por cálculo, o backend confere a base da empresa, depois o
/// cache e só então a Receita - e o que voltar preenche o formulário (só o que
/// ainda está vazio, nunca sobrescreve o digitado). Com [clienteId] é edição:
/// documento e código não mudam (o PATCH do Radar não aceita) e os contatos
/// ficam de fora. Em ambos a gravação é no Postgres e o envio ao WK Radar é por
/// fila. Ao salvar, devolve o id do cliente (cadastro) ou `true` (edição).
class ClienteFormScreen extends ConsumerStatefulWidget {
  const ClienteFormScreen({super.key, this.clienteId});

  final String? clienteId;

  @override
  ConsumerState<ClienteFormScreen> createState() => _ClienteFormScreenState();
}

class _ClienteFormScreenState extends ConsumerState<ClienteFormScreen> {
  bool get _edicao => widget.clienteId != null;

  TipoPessoa _tipo = TipoPessoa.juridica;
  final _documento = TextEditingController();
  final _codigo = TextEditingController();
  final _razaoSocial = TextEditingController();
  final _nomeFantasia = TextEditingController();
  final _inscricaoEstadual = TextEditingController();
  final _rg = TextEditingController();
  final _nomeMae = TextEditingController();
  final _email = TextEditingController();
  final _limiteCredito = TextEditingController();
  String _dataNascimento = '';

  _SituacaoDocumento _situacaoDocumento = _SituacaoDocumento.ocioso;
  String _mensagemDocumento = '';
  // Documento já consultado (evita reconsultar o mesmo) e o que está em
  // consulta agora (descarta resposta de um documento que já foi trocado).
  String? _documentoConsultado;
  String? _documentoEmConsulta;

  final List<EnderecoFormulario> _enderecos = [];
  int? _cobranca;
  int? _entrega;
  int? _cobrancaInicial;
  int? _entregaInicial;
  // Marcado (padrão): entrega = cobrança, e o seletor de entrega some.
  bool _entregaIgual = true;

  List<Telefone> _telefones = const [];
  final List<ContatoFormulario> _contatos = [];

  // Edição: dados carregados do servidor.
  ClienteEdicao? _dadosEdicao;
  String? _erroCarga;
  bool _carregando = false;

  bool _salvando = false;
  String? _erro;

  @override
  void initState() {
    super.initState();
    if (_edicao) {
      _carregando = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _carregarEdicao());
    }
  }

  @override
  void dispose() {
    for (final c in [
      _documento,
      _codigo,
      _razaoSocial,
      _nomeFantasia,
      _inscricaoEstadual,
      _rg,
      _nomeMae,
      _email,
      _limiteCredito,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  // ------------------------------------------------------------- edição

  Future<void> _carregarEdicao() async {
    setState(() {
      _carregando = true;
      _erroCarga = null;
    });
    try {
      final dados = await ref.read(cadastroClienteServiceProvider).obterParaEdicao(widget.clienteId!);
      if (!mounted) return;
      setState(() {
        _dadosEdicao = dados;
        _tipo = dados.tipoPessoa ?? TipoPessoa.juridica;
        _documento.text = dados.cpfCnpj == null ? '—' : formatarDocumento(dados.cpfCnpj!);
        _codigo.text = dados.codigo ?? '—';
        _razaoSocial.text = dados.razaoSocial ?? '';
        _nomeFantasia.text = dados.nomeFantasia ?? '';
        _inscricaoEstadual.text = dados.inscricaoEstadual ?? '';
        _rg.text = dados.rg ?? '';
        _nomeMae.text = dados.nomeMae ?? '';
        _dataNascimento = dados.dataNascimento ?? '';
        _email.text = dados.email ?? '';
        _limiteCredito.text = formatarValorParaCampo(dados.limiteCredito);
        _telefones = dados.telefones;
        _entregaIgual = dados.entregaIgualCobranca;
        if (dados.enderecoCobranca != null) {
          _enderecos.add(dados.enderecoCobranca!.paraFormulario());
          _cobranca = 0;
        }
        if (dados.enderecoEntrega != null && !dados.entregaIgualCobranca) {
          _enderecos.add(dados.enderecoEntrega!.paraFormulario());
          _entrega = _enderecos.length - 1;
        }
        _cobrancaInicial = _cobranca;
        _entregaInicial = _entrega;
        _carregando = false;
      });
    } catch (erro) {
      if (!mounted) return;
      setState(() {
        _carregando = false;
        _erroCarga = erro is ApiException && erro.statusCode == 404
            ? 'Cliente não encontrado.'
            : ref.read(cadastroClienteServiceProvider).mensagemDeErro(erro);
      });
    }
  }

  // ---------------------------------------------------------- documento

  void _aoMudarTipo(bool fisica) {
    setState(() {
      _tipo = fisica ? TipoPessoa.fisica : TipoPessoa.juridica;
      _documento.clear();
      _documentoConsultado = null;
      _documentoEmConsulta = null;
      _situacaoDocumento = _SituacaoDocumento.ocioso;
    });
  }

  void _aoMudarDocumento(String valor) {
    final normalizado = normalizarDocumento(valor);
    final tamanho = _tipo == TipoPessoa.fisica ? 11 : 14;

    if (normalizado.length < tamanho) {
      setState(() {
        _documentoConsultado = null;
        _situacaoDocumento = _SituacaoDocumento.ocioso;
      });
      return;
    }
    // Validação por cálculo ANTES de qualquer chamada ao backend.
    if (tipoPessoaDoDocumento(normalizado) != _tipo) {
      setState(() {
        _documentoConsultado = null;
        _situacaoDocumento = _SituacaoDocumento.erro;
        _mensagemDocumento = _tipo == TipoPessoa.fisica ? 'CPF inválido.' : 'CNPJ inválido.';
      });
      return;
    }
    if (_documentoConsultado == normalizado) return;
    _consultar(normalizado);
  }

  Future<void> _consultar(String normalizado) async {
    setState(() {
      _documentoConsultado = normalizado;
      _documentoEmConsulta = normalizado;
      _situacaoDocumento = _SituacaoDocumento.consultando;
    });
    final resposta = await ref.read(cadastroClienteServiceProvider).consultarDocumento(normalizado);
    if (!mounted || _documentoEmConsulta != normalizado) return;

    setState(() {
      switch (resposta) {
        case DocumentoCnpj(:final resultado):
          _autopreencher(resultado);
          _situacaoDocumento = _SituacaoDocumento.ok;
          _mensagemDocumento = 'Dados da Receita Federal preenchidos.';
        case DocumentoCpfLivre():
          _situacaoDocumento = _SituacaoDocumento.ok;
          _mensagemDocumento = 'CPF disponível para cadastro.';
        case DocumentoJaCadastrado(:final cliente):
          _situacaoDocumento = _SituacaoDocumento.jaCadastrado;
          _mensagemDocumento = cliente.mensagem;
        case DocumentoNaoEncontrado(:final mensagem):
          _situacaoDocumento = _SituacaoDocumento.aviso;
          _mensagemDocumento = mensagem;
        case DocumentoInvalido():
          _situacaoDocumento = _SituacaoDocumento.erro;
          _mensagemDocumento = 'Documento inválido.';
        case DocumentoErro(:final mensagem):
          // Libera pra reconsultar ("Tentar novamente").
          _documentoConsultado = null;
          _situacaoDocumento = _SituacaoDocumento.erro;
          _mensagemDocumento = mensagem;
      }
    });
  }

  /// Preenche só o que ainda está vazio - o usuário pode ter começado a
  /// digitar antes da consulta voltar. Roda dentro de setState.
  void _autopreencher(ConsultaCnpjResultado resultado) {
    final dados = resultado.dados;
    if (dados == null) return;

    if (_razaoSocial.text.isEmpty) _razaoSocial.text = dados.razaoSocial;
    if (_nomeFantasia.text.isEmpty) _nomeFantasia.text = dados.nomeFantasia ?? '';
    if (_email.text.isEmpty) _email.text = dados.email ?? '';
    if (_telefones.isEmpty) _telefones = extrairTelefones(dados.telefone);

    final endereco = resultado.enderecoSugerido?.paraFormulario();
    if (endereco != null && _enderecos.isEmpty) {
      // Mesmo endereço pra cobrança e entrega, como na tela de referência.
      _enderecos.add(endereco);
      _cobranca = 0;
      _entrega = 0;
    }
  }

  // ---------------------------------------------------------- endereços

  Future<void> _aoEscolherEndereco(bool cobranca, int valor) async {
    if (valor == seletorEnderecoNovo) {
      final novo = await Navigator.of(
        context,
      ).push<EnderecoFormulario>(MaterialPageRoute(builder: (_) => const EnderecoFormScreen()));
      if (novo == null || !mounted) return;
      setState(() {
        _enderecos.add(novo);
        final indice = _enderecos.length - 1;
        if (cobranca) {
          _cobranca = indice;
        } else {
          _entrega = indice;
        }
      });
      return;
    }
    final indice = valor == seletorEnderecoADefinir ? null : valor;
    setState(() {
      if (cobranca) {
        _cobranca = indice;
      } else {
        _entrega = indice;
      }
    });
  }

  // ------------------------------------------------------------ contatos

  Future<void> _adicionarContato() async {
    final contato = await Navigator.of(
      context,
    ).push<ContatoFormulario>(MaterialPageRoute(builder: (_) => const ContatoFormScreen()));
    if (contato != null && mounted) setState(() => _contatos.add(contato));
  }

  // ------------------------------------------------------------ nascimento

  Future<void> _escolherNascimento() async {
    final agora = DateTime.now();
    final atual = DateTime.tryParse(_dataNascimento);
    final data = await showDatePicker(
      context: context,
      initialDate: atual ?? DateTime(agora.year - 30),
      firstDate: DateTime(1900),
      lastDate: agora,
    );
    if (data == null) return;
    setState(() {
      _dataNascimento =
          '${data.year.toString().padLeft(4, '0')}-'
          '${data.month.toString().padLeft(2, '0')}-'
          '${data.day.toString().padLeft(2, '0')}';
    });
  }

  String get _nascimentoExibicao {
    final data = DateTime.tryParse(_dataNascimento);
    if (data == null) return 'Data de nascimento';
    return 'Nascimento: ${data.day.toString().padLeft(2, '0')}/'
        '${data.month.toString().padLeft(2, '0')}/${data.year}';
  }

  // --------------------------------------------------------------- salvar

  String? _validar() {
    final fisica = _tipo == TipoPessoa.fisica;
    if (!_edicao) {
      if (tipoPessoaDoDocumento(_documento.text) != _tipo) {
        return fisica ? 'Informe um CPF válido.' : 'Informe um CNPJ válido.';
      }
      if (_situacaoDocumento == _SituacaoDocumento.jaCadastrado) {
        return 'Este documento já está cadastrado.';
      }
      if (_situacaoDocumento == _SituacaoDocumento.consultando) {
        return 'Aguarde a consulta do documento terminar.';
      }
    }
    if (_razaoSocial.text.trim().isEmpty) {
      return fisica ? 'Informe o nome do cliente.' : 'Informe a razão social.';
    }
    if (_cobranca == null && (!_edicao || _cobrancaInicial != null)) {
      return 'Defina o endereço de cobrança.';
    }
    if (!_edicao) {
      if (!_entregaIgual && _entrega == null) {
        return 'Defina o endereço de entrega ou marque que é o mesmo da cobrança.';
      }
      if (_contatos.isEmpty) return 'Adicione pelo menos um contato.';
    }
    if (_email.text.trim().isNotEmpty && !emailEhValido(_email.text)) return 'E-mail inválido.';
    if (_limiteCredito.text.trim().isNotEmpty && parseValorMonetario(_limiteCredito.text) == null) {
      return 'Limite de crédito inválido.';
    }
    return null;
  }

  Future<void> _salvar() async {
    if (_salvando) return;
    final problema = _validar();
    if (problema != null) {
      setState(() => _erro = problema);
      return;
    }
    setState(() {
      _salvando = true;
      _erro = null;
    });
    try {
      if (_edicao) {
        await _salvarEdicao();
      } else {
        await _salvarCadastro();
      }
    } catch (erro) {
      if (!mounted) return;
      setState(() {
        _salvando = false;
        _erro = ref.read(cadastroClienteServiceProvider).mensagemDeErro(erro);
      });
    }
  }

  Future<void> _salvarCadastro() async {
    final cobranca = _enderecos[_cobranca!];
    final entrega = _entregaIgual ? cobranca : (_entrega != null ? _enderecos[_entrega!] : null);
    final payload = montarPayloadCriarCliente(
      documento: _documento.text,
      tipo: _tipo,
      codigo: _codigo.text,
      razaoSocial: _razaoSocial.text,
      nomeFantasia: _nomeFantasia.text,
      inscricaoEstadual: _inscricaoEstadual.text,
      rg: _rg.text,
      dataNascimento: _dataNascimento,
      nomeMae: _nomeMae.text,
      cobranca: cobranca,
      entrega: entrega,
      telefones: _telefones,
      email: _email.text,
      limiteCredito: parseValorMonetario(_limiteCredito.text),
      contatos: _contatos,
    );
    final criado = await ref.read(cadastroClienteServiceProvider).criar(payload);
    ref.invalidate(clientesProvider);
    if (!mounted) return;
    Navigator.of(context).pop(criado.id);
  }

  Future<void> _salvarEdicao() async {
    final cobrancaMudou = _cobranca != null && _cobranca != _cobrancaInicial;
    final entregaMudou = !_entregaIgual && _entrega != null && _entrega != _entregaInicial;
    final payload = montarPayloadAtualizarCliente(
      fisica: _tipo == TipoPessoa.fisica,
      razaoSocial: _razaoSocial.text,
      nomeFantasia: _nomeFantasia.text,
      inscricaoEstadual: _inscricaoEstadual.text,
      rg: _rg.text,
      dataNascimento: _dataNascimento,
      nomeMae: _nomeMae.text,
      email: _email.text,
      limiteCredito: parseValorMonetario(_limiteCredito.text),
      telefones: _telefones,
      entregaIgual: _entregaIgual,
      novaCobranca: cobrancaMudou ? _enderecos[_cobranca!] : null,
      novaEntrega: entregaMudou ? _enderecos[_entrega!] : null,
    );
    final situacao = await ref
        .read(cadastroClienteServiceProvider)
        .atualizar(widget.clienteId!, payload);
    if (!mounted) return;
    if (situacao == 'SEM_ALTERACAO') {
      setState(() {
        _salvando = false;
        _erro = 'Nada mudou - nenhuma alteração foi enviada.';
      });
      return;
    }
    ref.invalidate(clienteDetalheProvider(widget.clienteId!));
    ref.invalidate(clientesProvider);
    Navigator.of(context).pop(true);
  }

  // ---------------------------------------------------------------- build

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_edicao ? 'Editar cliente' : 'Novo cliente'),
        actions: [
          if (!_carregando && _erroCarga == null)
            TextButton(
              onPressed: _salvando ? null : _salvar,
              child: Text(_salvando ? 'Salvando...' : 'Salvar'),
            ),
        ],
      ),
      body: SafeArea(child: _corpo()),
    );
  }

  Widget _corpo() {
    if (_carregando) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }
    if (_erroCarga != null) {
      return Padding(
        padding: const EdgeInsets.all(18),
        child: ErroConexao(mensagem: _erroCarga!, aoTentarNovamente: _carregarEdicao),
      );
    }

    final fisica = _tipo == TipoPessoa.fisica;
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        if (_erro != null) ...[
          AppCard(child: Text(_erro!, style: const TextStyle(color: AppColors.red))),
          const SizedBox(height: 12),
        ],
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _documento,
                enabled: !_edicao,
                keyboardType: fisica ? TextInputType.number : TextInputType.text,
                textCapitalization: TextCapitalization.characters,
                inputFormatters: [MascaraFormatter((v) => aplicarMascaraDocumento(v, _tipo))],
                onChanged: _aoMudarDocumento,
                decoration: InputDecoration(
                  labelText: fisica ? 'CPF' : 'CNPJ',
                  hintText: fisica ? 'Digite o CPF' : 'Digite o CNPJ',
                ),
              ),
              _feedbackDocumento(),
              if (!_edicao)
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Pessoa Física'),
                  value: fisica,
                  onChanged: _aoMudarTipo,
                ),
              const SizedBox(height: 8),
              TextField(
                controller: _codigo,
                enabled: !_edicao,
                maxLength: 10,
                decoration: InputDecoration(
                  labelText: 'Código do cliente (Radar)',
                  hintText: 'Em branco: o Radar gera',
                  counterText: '',
                  helperText: _edicao ? 'Documento, tipo de pessoa e código não podem ser alterados.' : null,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        AppCard(
          child: Column(
            children: [
              if (fisica) ...[
                _campo(_razaoSocial, 'Nome', 'Nome do cliente', 80),
                _campo(_rg, 'RG', 'Digite o RG', 15),
                OutlinedButton.icon(
                  onPressed: _escolherNascimento,
                  icon: const Icon(Icons.cake_outlined, size: 18),
                  label: Text(_nascimentoExibicao),
                ),
                const SizedBox(height: 12),
                _campo(_nomeMae, 'Filiação', 'Nome da mãe', 50),
                if (_edicao && _dadosEdicao?.camposPessoaFisicaConhecidos == false)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 12),
                    child: Text(
                      'RG, nascimento e filiação deste cliente estão no Radar e não aparecem aqui: em '
                      'branco, ficam como estão; preenchidos, substituem o que estiver lá.',
                      style: TextStyle(fontSize: 12, color: AppColors.muted),
                    ),
                  ),
              ] else ...[
                _campo(_nomeFantasia, 'Nome Fantasia', 'Nome fantasia da empresa', 50),
                _campo(_razaoSocial, 'Razão Social', 'Razão social da empresa', 80),
              ],
              _campo(_inscricaoEstadual, 'Inscrição Estadual', 'Digite a Inscrição Estadual', 17),
            ],
          ),
        ),
        const SizedBox(height: 12),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SeletorEndereco(
                rotulo: 'Endereço de Cobrança',
                enderecos: _enderecos,
                selecionado: _cobranca,
                aoEscolher: (valor) => _aoEscolherEndereco(true, valor),
              ),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                title: const Text('Endereço de entrega igual ao de cobrança'),
                value: _entregaIgual,
                onChanged: (marcado) => setState(() => _entregaIgual = marcado ?? true),
              ),
              if (!_entregaIgual)
                SeletorEndereco(
                  rotulo: 'Endereço de Entrega',
                  enderecos: _enderecos,
                  selecionado: _entrega,
                  aoEscolher: (valor) => _aoEscolherEndereco(false, valor),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CampoTelefones(
                rotulo: 'Telefones',
                telefones: _telefones,
                aoMudar: (telefones) => setState(() => _telefones = telefones),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'E-mail', hintText: 'Digite o email'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _limiteCredito,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
                decoration: const InputDecoration(
                  labelText: 'Limite de Crédito',
                  hintText: 'Digite o valor limite',
                ),
              ),
            ],
          ),
        ),
        if (!_edicao) ...[
          const SizedBox(height: 12),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Contatos', style: TextStyle(fontWeight: FontWeight.w700)),
                          Text(
                            'Obrigatório: adicione pelo menos um contato.',
                            style: TextStyle(fontSize: 12, color: AppColors.muted),
                          ),
                        ],
                      ),
                    ),
                    OutlinedButton(onPressed: _adicionarContato, child: const Text('Adicionar')),
                  ],
                ),
                const SizedBox(height: 8),
                if (_contatos.isEmpty)
                  const Text('Nenhum contato adicionado.', style: TextStyle(color: AppColors.muted))
                else
                  for (var i = 0; i < _contatos.length; i++)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(_contatos[i].nome),
                      subtitle: Text(_contatos[i].resumo.isEmpty ? 'Sem outros dados' : _contatos[i].resumo),
                      trailing: IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        tooltip: 'Remover contato',
                        onPressed: () => setState(() => _contatos.removeAt(i)),
                      ),
                    ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 18),
        FilledButton(
          onPressed: _salvando ? null : _salvar,
          child: Text(_salvando ? 'Salvando...' : 'Salvar'),
        ),
      ],
    );
  }

  Widget _campo(TextEditingController controller, String rotulo, String dica, int maximo) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        maxLength: maximo,
        decoration: InputDecoration(labelText: rotulo, hintText: dica, counterText: ''),
      ),
    );
  }

  Widget _feedbackDocumento() {
    final (texto, cor) = switch (_situacaoDocumento) {
      _SituacaoDocumento.ocioso => ('', AppColors.muted),
      _SituacaoDocumento.consultando => ('Consultando...', AppColors.muted),
      _SituacaoDocumento.ok || _SituacaoDocumento.aviso => (_mensagemDocumento, AppColors.muted),
      _SituacaoDocumento.jaCadastrado || _SituacaoDocumento.erro => (_mensagemDocumento, AppColors.red),
    };
    if (texto.isEmpty) return const SizedBox.shrink();
    final podeRepetir =
        _situacaoDocumento == _SituacaoDocumento.erro && !_mensagemDocumento.contains('inválido');
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text(texto, style: TextStyle(fontSize: 12, color: cor)),
          if (podeRepetir)
            TextButton(
              onPressed: () => _consultar(normalizarDocumento(_documento.text)),
              child: const Text('Tentar novamente'),
            ),
        ],
      ),
    );
  }
}
