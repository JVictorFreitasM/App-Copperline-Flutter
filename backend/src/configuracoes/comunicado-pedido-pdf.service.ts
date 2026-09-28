import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ComunicadoPedidoPdfDto {
  texto: string;
  atualizadoEm: string;
}

// Singleton (1 linha) - "Comunicado" (2a pagina do PDF de impressao do
// pedido, "Premissas e Outras Observacoes" no modelo de referencia).
// Pedido explicito do usuario (2026-09-28): relacao 1:N - so o texto ATUAL
// importa, aplicado a todo PDF gerado dali em diante (geracao e' sempre
// sob demanda, nunca pre-gerada - mudar aqui afeta o proximo PDF de
// QUALQUER pedido, sem historico/versionamento por pedido).
@Injectable()
export class ComunicadoPedidoPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(): Promise<ComunicadoPedidoPdfDto> {
    const comunicado = await this.obterOuCriarLinha();
    return paraDto(comunicado);
  }

  async atualizar(texto: string): Promise<ComunicadoPedidoPdfDto> {
    const existente = await this.obterOuCriarLinha();
    const atualizado = await this.prisma.comunicadoPedidoPdf.update({
      where: { id: existente.id },
      data: { texto },
    });
    return paraDto(atualizado);
  }

  private async obterOuCriarLinha() {
    const existente = await this.prisma.comunicadoPedidoPdf.findFirst();
    if (existente) {
      return existente;
    }
    return this.prisma.comunicadoPedidoPdf.create({ data: {} });
  }
}

function paraDto(comunicado: { texto: string; atualizadoEm: Date }): ComunicadoPedidoPdfDto {
  return {
    texto: comunicado.texto,
    atualizadoEm: comunicado.atualizadoEm.toISOString(),
  };
}
