import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DefinirLocalizacaoInput {
  latitude: number;
  longitude: number;
}

export interface ClienteLocalizacaoDto {
  clienteId: string;
  latitude: number;
  longitude: number;
  definidaEm: string;
}

// "Pin" de localizacao do cliente (extensao pos-OS-BACKEND-28) - endpoint
// dedicado, decisao confirmada com o usuario (nao acoplado ao fluxo de
// check-in). Serve de referencia pra VisitasService validar distancia de
// check-in/checkout. So o vendedor vinculado ao cliente pode definir/
// redefinir (mesmo criterio de "cliente proprio" ja usado em
// VisitasService.checkin, nao o escopo de leitura de equipe).
@Injectable()
export class ClienteLocalizacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async definir(
    usuarioId: string,
    clienteId: string,
    input: DefinirLocalizacaoInput,
  ): Promise<ClienteLocalizacaoDto> {
    const vendedor = await this.prisma.vendedor.findFirst({
      where: { usuarioId },
    });
    if (!vendedor) {
      throw new ForbiddenException(
        'Usuário autenticado não é um vendedor cadastrado - não pode definir localização de cliente',
      );
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, vendedores: { some: { vendedorId: vendedor.id } } },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const atualizado = await this.prisma.cliente.update({
      where: { id: clienteId },
      data: {
        localizacaoLat: input.latitude,
        localizacaoLng: input.longitude,
        localizacaoDefinidaEm: new Date(),
        localizacaoDefinidaPorId: vendedor.id,
      },
    });

    return {
      clienteId: atualizado.id,
      latitude: atualizado.localizacaoLat!.toNumber(),
      longitude: atualizado.localizacaoLng!.toNumber(),
      definidaEm: atualizado.localizacaoDefinidaEm!.toISOString(),
    };
  }
}
