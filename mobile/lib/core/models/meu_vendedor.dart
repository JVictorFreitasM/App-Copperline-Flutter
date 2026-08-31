/// Mesmo shape de `backend/src/vendedores/vendedores.controller.ts`
/// (MeuVendedorDto, GET /vendedores/me, OS-WEB-21) - usado aqui só pra
/// decidir se mostra o atalho de Aprovações (OS-MOBILE-26), mesmo critério
/// do web (`frontend/src/components/design/app-shell.tsx`).
class MeuVendedor {
  const MeuVendedor({required this.vendedorId, required this.papel, required this.podeAprovar});

  factory MeuVendedor.fromJson(Map<String, dynamic> json) {
    return MeuVendedor(
      vendedorId: json['vendedorId'] as String?,
      papel: json['papel'] as String?,
      podeAprovar: json['podeAprovar'] as bool,
    );
  }

  final String? vendedorId;
  final String? papel;
  final bool podeAprovar;
}
