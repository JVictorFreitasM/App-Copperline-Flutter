import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/auth/auth_notifier.dart';
import '../core/formatacao.dart';
import '../core/providers/aprovacoes_provider.dart';
import '../core/providers/dashboard_provider.dart';
import '../core/providers/offline_provider.dart';
import '../core/providers/visitas_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/listagem_feedback.dart';
import 'aprovacoes_screen.dart';
import 'busca_screen.dart';
import 'clientes_screen.dart';
import 'pedidos_screen.dart';
import 'shell/documentos_screen.dart';

String _hojeIso() => DateTime.now().toIso8601String().substring(0, 10);

String _saudacao() {
  final hora = DateTime.now().hour;
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

const _diasSemana = [
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
  'domingo',
];
const _meses = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

String _dataPorExtenso() {
  final agora = DateTime.now();
  final dia = _diasSemana[agora.weekday - 1];
  return '$dia, ${agora.day} de ${_meses[agora.month - 1]}'.toUpperCase();
}

/// Aba "Início" - replica a referência "Nexo Comercial"
/// (Downloads/aplicativo-comercial-interno, tela 1.jpg): saudação +
/// card de prioridade (aprovações pendentes) + grade de acesso rápido
/// 2x2 + resumo de hoje. Tudo com dado real já buscado no backend
/// (OS-BACKEND-17/OS-MOBILE-26) - a referência também mostra uma barra de
/// "rota concluída X de Y", omitida aqui de propósito: não existe conceito
/// de rota/meta diária planejada no backend, seria inventar dado.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usuario = ref.watch(authProvider).value?.usuario;
    final resumo = ref.watch(resumoDashboardProvider);
    final visitasHoje = ref.watch(minhasVisitasProvider(_hojeIso()));

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(resumoDashboardProvider);
        ref.invalidate(minhasVisitasProvider(_hojeIso()));
        await ref.read(resumoDashboardProvider.future);
      },
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _dataPorExtenso(),
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                        color: AppColors.muted,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      usuario != null
                          ? '${_saudacao()}, ${usuario.name.split(' ').first}.'
                          : '${_saudacao()}.',
                      style: Theme.of(context).textTheme.displayLarge,
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Veja o que precisa da sua atenção hoje.',
                      style: TextStyle(color: AppColors.muted, fontSize: 13),
                    ),
                  ],
                ),
              ),
              if (usuario != null)
                CircleAvatar(
                  radius: 20,
                  backgroundColor: AppColors.primaryLight,
                  child: Text(
                    _iniciais(usuario.name),
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 20),
          const _IndicadorAcoesPendentes(),
          const _CardPrioridade(),
          _CampoBuscaAtalho(
            onTap: () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => const BuscaScreen())),
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Acesso rápido', style: Theme.of(context).textTheme.titleMedium),
              _RotuloPapel(usuario: usuario, ref: ref),
            ],
          ),
          const SizedBox(height: 10),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.55,
            children: [
              _AcaoRapida(
                // A referência ("Nexo Comercial") chama este card de "Novo
                // pedido" e leva direto à criação - mas criação de pedido
                // não existe no app (mesmo bloqueio de negócio da
                // OS-MOBILE-23: falta definição de tipoVenda/IDs do ERP,
                // ver OS-BACKEND-24/25). Renomear pra "Novo pedido" sem ter
                // pra onde levar prometeria uma função que não existe -
                // mantido como "Pedidos"/listagem até o bloqueio cair.
                icone: Icons.add,
                titulo: 'Pedidos',
                subtitulo: 'Ver carteira',
                destaque: true,
                onTap: () => Navigator.of(
                  context,
                ).push(MaterialPageRoute(builder: (_) => const PedidosScreen())),
              ),
              _AcaoRapida(
                // Check-in em si fica no detalhe do cliente (ver
                // cliente_detalhe_screen.dart) - ClientesScreen aqui é o
                // passo intermediário "escolha o cliente pra registrar a
                // visita" (OS-ajustes-layout-mobile, item 2).
                icone: Icons.location_on_outlined,
                titulo: 'Check-in',
                subtitulo: 'Escolher cliente',
                onTap: () => Navigator.of(
                  context,
                ).push(MaterialPageRoute(builder: (_) => const ClientesScreen())),
              ),
              _AcaoRapida(
                // Antes apontava pra ClientesScreen, igual ao card de
                // Check-in acima - redundante com o atalho de busca já no
                // topo da Home (_CampoBuscaAtalho) e sem diferenciação
                // nenhuma entre os dois cards (OS-ajustes-layout-mobile,
                // item 2). BuscaScreen é a busca global de verdade
                // (cliente/produto/pedido), já usada no menu lateral.
                icone: Icons.search,
                titulo: 'Buscar cliente',
                subtitulo: 'Busca global',
                onTap: () => Navigator.of(
                  context,
                ).push(MaterialPageRoute(builder: (_) => const BuscaScreen())),
              ),
              _AcaoRapida(
                icone: Icons.description_outlined,
                titulo: 'Documentos',
                subtitulo: 'Notas e arquivos',
                onTap: () => Navigator.of(
                  context,
                ).push(MaterialPageRoute(builder: (_) => const DocumentosScreen())),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const Divider(color: AppColors.line, height: 1),
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Resumo de hoje', style: Theme.of(context).textTheme.titleMedium),
            ],
          ),
          const SizedBox(height: 14),
          resumo.when(
            data: (dados) => Row(
              children: [
                Expanded(
                  child: _Metrica(
                    valor: visitasHoje.maybeWhen(
                      data: (v) => '${v.length}'.padLeft(2, '0'),
                      orElse: () => '—',
                    ),
                    rotulo: 'visitas',
                  ),
                ),
                Expanded(
                  child: _Metrica(
                    valor: '${dados.pedidosEmAberto}'.padLeft(2, '0'),
                    rotulo: 'pedidos em aberto',
                  ),
                ),
                Expanded(
                  child: _Metrica(
                    valor: formatarMoeda(dados.valorFaturadoRecente),
                    rotulo: 'faturado (${dados.periodoValorFaturadoDias}d)',
                    ultimo: true,
                  ),
                ),
              ],
            ),
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
            ),
            error: (erro, _) => ErroConexao(
              mensagem: '$erro',
              aoTentarNovamente: () => ref.invalidate(resumoDashboardProvider),
            ),
          ),
        ],
      ),
    );
  }

  String _iniciais(String nome) {
    final partes = nome.trim().split(RegExp(r'\s+'));
    if (partes.isEmpty) return '?';
    if (partes.length == 1) return partes.first.substring(0, 1).toUpperCase();
    return (partes.first.substring(0, 1) + partes.last.substring(0, 1)).toUpperCase();
  }
}

class _RotuloPapel extends StatelessWidget {
  const _RotuloPapel({required this.usuario, required this.ref});

  final dynamic usuario;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final papel = ref.watch(meuVendedorProvider).value?.papel;
    if (papel == null || papel == 'VENDEDOR') return const SizedBox.shrink();
    return Text(
      papel == 'GERENTE' ? 'GERENTE' : 'SUPERVISOR',
      style: const TextStyle(
        color: AppColors.primary,
        fontWeight: FontWeight.w800,
        fontSize: 10,
        letterSpacing: 1,
      ),
    );
  }
}

/// Card de prioridade (âmbar) - só aparece quando existe algo real
/// aguardando: solicitações de desconto pendentes (OS-MOBILE-26), pra
/// quem tem papel de supervisão. Sem dado real, o card simplesmente não
/// aparece - a referência sempre mostra um valor fixo ("2 aprovações"),
/// aqui é sempre o que existir de verdade.
class _CardPrioridade extends ConsumerWidget {
  const _CardPrioridade();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final podeAprovar = ref.watch(meuVendedorProvider).value?.podeAprovar ?? false;
    if (!podeAprovar) return const SizedBox.shrink();

    final solicitacoes = ref.watch(solicitacoesPendentesProvider);
    final total = solicitacoes.maybeWhen(data: (lista) => lista.length, orElse: () => 0);
    if (total == 0) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.of(
          context,
        ).push(MaterialPageRoute(builder: (_) => const AprovacoesScreen())),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.amberLight,
            border: Border.all(color: const Color(0xFFF1D39E)),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              const Icon(Icons.error_outline, color: AppColors.amber, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'PRIORIDADE DO DIA',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                        color: AppColors.amber,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      total == 1
                          ? '1 aprovação aguardando'
                          : '$total aprovações aguardando',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 3),
                    const Text(
                      'Revise as solicitações de desconto da sua equipe.',
                      style: TextStyle(fontSize: 11, color: Color(0xFF6F562E)),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.muted, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

class _Metrica extends StatelessWidget {
  const _Metrica({required this.valor, required this.rotulo, this.ultimo = false});

  final String valor;
  final String rotulo;
  final bool ultimo;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(left: 10),
      decoration: BoxDecoration(
        border: ultimo
            ? null
            : const Border(right: BorderSide(color: AppColors.line)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            valor,
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.bold,
              letterSpacing: -0.5,
            ),
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(rotulo, style: const TextStyle(color: AppColors.muted, fontSize: 10)),
        ],
      ),
    );
  }
}

class _AcaoRapida extends StatelessWidget {
  const _AcaoRapida({
    required this.icone,
    required this.titulo,
    required this.subtitulo,
    required this.onTap,
    this.destaque = false,
  });

  final IconData icone;
  final String titulo;
  final String subtitulo;
  final VoidCallback onTap;
  final bool destaque;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: destaque ? AppColors.navy : AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: destaque ? null : Border.all(color: AppColors.line),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: destaque ? AppColors.primary : AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: Icon(
                  icone,
                  size: 17,
                  color: destaque ? Colors.white : AppColors.primary,
                ),
              ),
              const Spacer(),
              Text(
                titulo,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: destaque ? Colors.white : AppColors.foreground,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitulo,
                style: TextStyle(
                  fontSize: 11,
                  color: destaque ? const Color(0xFFB7C7CF) : AppColors.muted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Indicador de "pendente de envio" (OS-MOBILE-22) - só aparece quando há
/// ação offline aguardando sincronizar.
class _IndicadorAcoesPendentes extends ConsumerWidget {
  const _IndicadorAcoesPendentes();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contagem = ref.watch(contagemPendentesProvider);

    return contagem.when(
      data: (total) {
        if (total == 0) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: InkWell(
            onTap: () async {
              await ref.read(offlineSyncNotifierProvider).sincronizarAgora();
            },
            borderRadius: BorderRadius.circular(999),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.background,
                border: Border.all(color: AppColors.line),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                children: [
                  const Icon(Icons.cloud_upload_outlined, size: 15, color: AppColors.muted),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      total == 1
                          ? '1 ação aguardando envio - toque para tentar agora'
                          : '$total ações aguardando envio - toque para tentar agora',
                      style: const TextStyle(fontSize: 11, color: AppColors.muted),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
    );
  }
}

class _CampoBuscaAtalho extends StatelessWidget {
  const _CampoBuscaAtalho({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border.all(color: AppColors.line),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Row(
          children: [
            Icon(Icons.search, size: 18, color: AppColors.muted),
            SizedBox(width: 9),
            Text(
              'Buscar cliente, produto ou pedido...',
              style: TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
