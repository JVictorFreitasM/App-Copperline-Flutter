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

/// Mesmo shape de `backend/src/vendedores/vendedores-hierarquia.service.ts`
/// (VendedorEquipeDto, GET /vendedores/equipe) - usado pra deixar
/// supervisor/gerente escolher "em nome de qual vendedor da equipe" criar
/// o pedido (mesmo campo `vendedorId` de CriarPedidoDto, ver
/// criar_pedido_screen.dart).
class VendedorEquipe {
  const VendedorEquipe({required this.id, required this.nome});

  factory VendedorEquipe.fromJson(Map<String, dynamic> json) {
    return VendedorEquipe(id: json['id'] as String, nome: json['nome'] as String?);
  }

  final String id;
  final String? nome;
}
