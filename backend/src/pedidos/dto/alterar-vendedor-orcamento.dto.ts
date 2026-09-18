import { IsUUID } from 'class-validator';

// PATCH /pedidos/:id/vendedor (Epico 4, config-aba-orcamento.jpg -
// "Permitir alteração de vendedor de um orçamento criado").
export class AlterarVendedorOrcamentoDto {
  @IsUUID()
  vendedorId!: string;
}
