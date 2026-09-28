import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DadosEmpresaPdfDto {
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  cep: string;
  telefone: string;
  atualizadoEm: string;
}

export interface AtualizarDadosEmpresaPdfInput {
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  cep: string;
  telefone: string;
}

// Singleton (1 linha) - cabecalho fixo do PDF de impressao do pedido
// (bloco superior esquerdo: razao social/CNPJ/endereco/telefone), aba
// "Documento do Pedido" da tela de Configuracoes (pedido do usuario,
// 2026-09-28). Mesmo padrao de ConfiguracaoOrcamentoService.
@Injectable()
export class DadosEmpresaPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(): Promise<DadosEmpresaPdfDto> {
    const dados = await this.obterOuCriarLinha();
    return paraDto(dados);
  }

  async atualizar(input: AtualizarDadosEmpresaPdfInput): Promise<DadosEmpresaPdfDto> {
    const existente = await this.obterOuCriarLinha();
    const atualizado = await this.prisma.dadosEmpresaPdf.update({
      where: { id: existente.id },
      data: input,
    });
    return paraDto(atualizado);
  }

  private async obterOuCriarLinha() {
    const existente = await this.prisma.dadosEmpresaPdf.findFirst();
    if (existente) {
      return existente;
    }
    return this.prisma.dadosEmpresaPdf.create({ data: {} });
  }
}

function paraDto(dados: {
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  cep: string;
  telefone: string;
  atualizadoEm: Date;
}): DadosEmpresaPdfDto {
  return {
    razaoSocial: dados.razaoSocial,
    cnpj: dados.cnpj,
    endereco: dados.endereco,
    cep: dados.cep,
    telefone: dados.telefone,
    atualizadoEm: dados.atualizadoEm.toISOString(),
  };
}
