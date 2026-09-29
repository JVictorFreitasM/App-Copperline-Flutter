import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer-core';
import { ComunicadoPedidoPdfService } from '../configuracoes/comunicado-pedido-pdf.service';
import { DadosEmpresaPdfService } from '../configuracoes/dados-empresa-pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import type { PedidoDetalheDto, PedidoItemDto } from './dto/pedido-response.dto';
import { PedidosService } from './pedidos.service';

// Caminho fixo (nao configuravel) - a logo faz parte da identidade visual
// do documento, nao um dado de negocio (ver Dockerfile: copiado pra
// ./assets no runtime, ao lado de ./dist).
const CAMINHO_LOGO = join(process.cwd(), 'assets', 'logo-copperline.jpg');

// SVG generico (rolo de cabo) - nao existe cadastro de imagem por produto
// no sistema (WK Radar nao expoe isso), entao todo item usa o mesmo icone,
// so pra manter a fidelidade visual do modelo de referencia (bloco
// "Produto" da tabela).
const ICONE_PRODUTO_SVG = `
<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="20" r="18" fill="#8a4a2f"/>
  <circle cx="20" cy="20" r="13" fill="none" stroke="#c97a4a" stroke-width="2"/>
  <circle cx="20" cy="20" r="8" fill="none" stroke="#c97a4a" stroke-width="2"/>
  <circle cx="20" cy="20" r="3" fill="#5a2e1c"/>
</svg>`;

function formatarMoeda(valor: string | null): string {
  const numero = valor ? Number(valor) : 0;
  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatarDataHora(data: Date | string | null): string {
  if (!data) return '—';
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarUnidade(unidade: string | null): string {
  // Quantidade exibida (item.quantidadeVenda) ja esta em KM pra item METRO
  // (retalho) - ver quantidadeVendaExterna em criar-pedido.service.ts. So
  // a letra mudou (pedido do usuario, 2026-09-28) - continua vindo do
  // mesmo campo, sem recalculo nenhum.
  if (unidade === 'METRO') return '(KM)';
  if (unidade === 'PECA') return '(UN)';
  return '';
}

interface EnderecoBruto {
  nomeEndereco?: string | null;
  numero?: number | null;
  complemento?: string | null;
  bairro?: string | null;
  uf?: string | null;
  cep?: string | null;
  telefones?: { ddd?: string | null; numero?: string | null }[] | null;
}

function formatarEndereco(endereco: EnderecoBruto | undefined): string {
  if (!endereco) return '—';
  const linha1 = [endereco.nomeEndereco, endereco.numero]
    .filter((valor) => valor !== null && valor !== undefined && valor !== '')
    .join(', ');
  const complemento = endereco.complemento ? ` - ${endereco.complemento}` : '';
  const linha2 = [endereco.bairro, endereco.uf].filter(Boolean).join(' - ');
  const cep = endereco.cep ?? '';
  return [linha1 + complemento, linha2, cep].filter(Boolean).join(', ');
}

function telefoneEndereco(endereco: EnderecoBruto | undefined): string {
  const telefone = endereco?.telefones?.[0];
  if (!telefone?.numero) return '';
  return telefone.ddd ? `(${telefone.ddd}) ${telefone.numero}` : telefone.numero;
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Gera o PDF de impressao do pedido (botao "Exportar PDF" na tela de
// detalhe, pedido do usuario 2026-09-28) - replica o layout do modelo de
// referencia ("Velis - Forca de Vendas - Impressao de pedidos.pdf"), com
// os dados fixos (razao social/CNPJ/endereco da empresa, comunicado da 2a
// pagina) vindos da aba "Documento do Pedido" de Configuracoes, e o resto
// dos dados puxado do proprio pedido. Renderiza HTML->PDF via Chromium
// (puppeteer-core + binario apt, ver Dockerfile) em vez de desenhar PDF na
// mao (pdf-lib/PDFKit) - mais facil bater exatamente o layout de tabelas
// do modelo.
@Injectable()
export class PedidoPdfService {
  private readonly logger = new Logger(PedidoPdfService.name);
  private logoBase64: string | null = null;

  constructor(
    private readonly pedidosService: PedidosService,
    private readonly dadosEmpresaPdfService: DadosEmpresaPdfService,
    private readonly comunicadoPedidoPdfService: ComunicadoPedidoPdfService,
    private readonly prisma: PrismaService,
  ) {}

  async gerarPdf(id: string, escopo: EscopoClientes): Promise<{ buffer: Buffer; nomeArquivo: string }> {
    const [pedido, dadosEmpresa, comunicado] = await Promise.all([
      this.pedidosService.buscarPorId(id, escopo),
      this.dadosEmpresaPdfService.obter(),
      this.comunicadoPedidoPdfService.obter(),
    ]);

    const imagensProdutos = await this.obterImagensProdutos(
      pedido.itens.map((item) => item.produto?.id).filter((id): id is string => !!id),
    );
    const html = await this.montarHtml(pedido, dadosEmpresa, comunicado.texto, imagensProdutos);
    const buffer = await this.renderizarPdf(html);

    return {
      buffer,
      nomeArquivo: `pedido-${pedido.numero ?? pedido.id.slice(0, 8)}.pdf`,
    };
  }

  private async obterLogoBase64(): Promise<string> {
    if (this.logoBase64) {
      return this.logoBase64;
    }
    const bytes = await readFile(CAMINHO_LOGO);
    this.logoBase64 = bytes.toString('base64');
    return this.logoBase64;
  }

  // Pedido do usuario (2026-09-29): a mesma imagem cadastrada via upload
  // (individual ou em massa, ver ProdutoManualService) aparece no lugar do
  // icone generico no PDF. Busca em lote (1 query pra todos os produtos do
  // pedido, nao 1 por item) + le os bytes do disco e ja embute como data
  // URI (mesma tecnica da logo, ver obterLogoBase64) - produto sem imagem
  // cadastrada simplesmente nao entra no Map, e linhaProduto cai no SVG
  // generico (fallback combinado com o usuario).
  private async obterImagensProdutos(produtoIds: string[]): Promise<Map<string, string>> {
    const idsUnicos = [...new Set(produtoIds)];
    if (idsUnicos.length === 0) {
      return new Map();
    }

    const produtos = await this.prisma.produto.findMany({
      where: { id: { in: idsUnicos }, imagemCaminho: { not: null }, imagemTipoMime: { not: null } },
      select: { id: true, imagemCaminho: true, imagemTipoMime: true },
    });

    const imagens = new Map<string, string>();
    for (const produto of produtos) {
      try {
        const bytes = await readFile(produto.imagemCaminho as string);
        imagens.set(produto.id, `data:${produto.imagemTipoMime};base64,${bytes.toString('base64')}`);
      } catch (erro) {
        this.logger.warn(
          `Falha ao ler imagem do produto '${produto.id}' pro PDF - cai no icone generico: ${erro instanceof Error ? erro.message : erro}`,
        );
      }
    }
    return imagens;
  }

  private async montarHtml(
    pedido: PedidoDetalheDto,
    dadosEmpresa: { razaoSocial: string; cnpj: string; endereco: string; cep: string; telefone: string },
    comunicado: string,
    imagensProdutos: Map<string, string>,
  ): Promise<string> {
    const logo = await this.obterLogoBase64();
    const endereco = (pedido.cliente?.enderecos as EnderecoBruto[] | undefined)?.[0];
    const vendedor = pedido.vendedorResponsavel ?? pedido.vendedor;
    const pagamento = [pedido.condicaoPagamento?.nome, pedido.formaPagamento?.descricao]
      .filter(Boolean)
      .join(' - ');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; margin: 0; padding: 24px; }
  .cabecalho { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .cabecalho h1 { font-size: 16px; margin: 0 0 4px; }
  .cabecalho p { margin: 1px 0; }
  .cabecalho img { height: 64px; }
  .barra-pedido { display: flex; justify-content: space-between; border: 1px solid #999; padding: 8px 12px; font-weight: bold; margin-bottom: 0; }
  table.info { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  table.info td { border: 1px solid #999; padding: 8px 12px; vertical-align: top; }
  table.info td.rotulo { width: 160px; font-weight: bold; background: #f5f5f5; }
  table.produtos { width: 100%; border-collapse: collapse; margin-top: 16px; }
  table.produtos th { border: 1px solid #999; padding: 8px; background: #f5f5f5; text-align: center; font-size: 11px; }
  table.produtos td { border: 1px solid #999; padding: 8px; vertical-align: middle; }
  table.produtos td.produto { display: flex; gap: 10px; align-items: center; }
  table.produtos td.numerico { text-align: center; white-space: nowrap; }
  .nome-produto { font-weight: bold; }
  .meta-produto { font-size: 10px; color: #555; }
  .linha-total td { border: none; padding: 6px 8px; text-align: right; }
  .linha-total.total td { font-weight: bold; font-size: 13px; }
  .pagina-2 { page-break-before: always; }
  .comunicado-titulo { border-bottom: 1px solid #999; font-weight: bold; padding-bottom: 6px; margin-bottom: 12px; }
  .comunicado-texto { white-space: pre-wrap; line-height: 1.5; }
</style>
</head>
<body>
  <div class="cabecalho">
    <div>
      <h1>${escaparHtml(dadosEmpresa.razaoSocial || '—')}</h1>
      <p>CNPJ: ${escaparHtml(dadosEmpresa.cnpj || '—')}</p>
      <p>Endereço: ${escaparHtml(dadosEmpresa.endereco || '—')}</p>
      <p>CEP: ${escaparHtml(dadosEmpresa.cep || '—')}</p>
      <p>Telefone: ${escaparHtml(dadosEmpresa.telefone || '—')}</p>
    </div>
    <img src="data:image/jpeg;base64,${logo}" alt="Copperline" />
  </div>

  <div class="barra-pedido">
    <span>Pedido Nº ${escaparHtml(pedido.numero ?? pedido.id.slice(0, 8))}</span>
    <span>Enviado em: ${formatarDataHora(pedido.horarioEnvio ?? pedido.sincronizadoEm)}</span>
  </div>

  <table class="info">
    <tr>
      <td class="rotulo">Cliente</td>
      <td colspan="3">
        ${escaparHtml(pedido.cliente?.nomeFantasia ?? pedido.cliente?.razaoSocial ?? '—')}<br/>
        ${escaparHtml(pedido.cliente?.razaoSocial ?? '—')}<br/>
        ${escaparHtml(telefoneEndereco(endereco))}
      </td>
    </tr>
    <tr>
      <td class="rotulo">CNPJ</td>
      <td>${escaparHtml(pedido.cliente?.cpfCnpj ?? '—')}</td>
      <td class="rotulo" style="width:60px">IE</td>
      <td>${escaparHtml(pedido.cliente?.inscricaoEstadual ?? '—')}</td>
    </tr>
    <tr>
      <td class="rotulo">Endereço de<br/>entrega/cobrança</td>
      <td colspan="3">${escaparHtml(formatarEndereco(endereco))}</td>
    </tr>
    <tr>
      <td class="rotulo">Contato</td>
      <td colspan="3">
        ${escaparHtml(pedido.contato?.nome ?? '—')}<br/>
        ${escaparHtml(
          pedido.contato?.telefoneDdd
            ? `(${pedido.contato.telefoneDdd}) ${pedido.contato.telefoneNumero ?? ''}`
            : '',
        )}
      </td>
    </tr>
    <tr>
      <td class="rotulo">Vendedor(a)</td>
      <td colspan="3">
        ${escaparHtml(vendedor?.nome ?? '—')}<br/>
        ${escaparHtml(vendedor?.email ?? '')}<br/>
        ${vendedor?.whatsapp ? `WhatsApp ${escaparHtml(vendedor.whatsapp)}` : ''}
      </td>
    </tr>
    <tr>
      <td class="rotulo">Peso Total</td>
      <td>
        <b>Bruto:</b> ${pedido.pesoBrutoTotalKg ? `${Number(pedido.pesoBrutoTotalKg).toLocaleString('pt-BR')}Kg` : '—'} /
        <b>Líquido:</b> ${pedido.pesoLiquidoTotalKg ? `${Number(pedido.pesoLiquidoTotalKg).toLocaleString('pt-BR')}Kg` : '—'}
      </td>
      <td class="rotulo" style="width:100px">Valor Total</td>
      <td>${formatarMoeda(pedido.valorTotal)}</td>
    </tr>
    <tr>
      <td class="rotulo">Pagamento</td>
      <td colspan="3">${escaparHtml(pagamento || '—')}</td>
    </tr>
  </table>

  <table class="produtos">
    <thead>
      <tr>
        <th style="width:55%">Produto</th>
        <th>QTDE</th>
        <th>Valor Unit.</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${pedido.itens
        .map((item) => linhaProduto(item, item.produto?.id ? imagensProdutos.get(item.produto.id) : undefined))
        .join('')}
    </tbody>
  </table>

  <table class="produtos" style="margin-top:0">
    <tr class="linha-total">
      <td style="width:55%; border:none"></td>
      <td colspan="2">Subtotal:</td>
      <td>${formatarMoeda(pedido.valorTotal)}</td>
    </tr>
    <tr class="linha-total total">
      <td style="width:55%; border:none"></td>
      <td colspan="2">Valor Total:</td>
      <td>${formatarMoeda(pedido.valorTotal)}</td>
    </tr>
  </table>

  <div class="pagina-2">
    <p class="comunicado-titulo">Premissas e Outras Observações</p>
    <p class="comunicado-texto">${escaparHtml(comunicado)}</p>
  </div>
</body>
</html>`;
  }

  private async renderizarPdf(html: string): Promise<Buffer> {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (!executablePath) {
      throw new Error(
        'PUPPETEER_EXECUTABLE_PATH não configurado - necessário pra localizar o binário do Chromium (ver Dockerfile)',
      );
    }

    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'a4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close().catch((erro) => {
        this.logger.warn(`Falha ao fechar o Chromium após gerar PDF: ${erro}`);
      });
    }
  }
}

function linhaProduto(item: PedidoItemDto, imagemDataUri: string | undefined): string {
  const quantidade = item.quantidadeVenda ? Number(item.quantidadeVenda).toLocaleString('pt-BR') : '—';
  const icone = imagemDataUri
    ? `<img src="${imagemDataUri}" alt="" width="40" height="40" style="object-fit:cover; border-radius:50%;" />`
    : ICONE_PRODUTO_SVG;
  return `
    <tr>
      <td class="produto">
        ${icone}
        <div>
          <div class="nome-produto">${escaparHtml(item.produto?.nome ?? '—')}</div>
          <div class="meta-produto">Código: ${escaparHtml(item.produto?.codigo ?? '—')}</div>
        </div>
      </td>
      <td class="numerico">${quantidade}<br/><span class="meta-produto">${formatarUnidade(item.unidade)}</span></td>
      <td class="numerico">${formatarMoeda(item.valorUnitario)}</td>
      <td class="numerico">${formatarMoeda(item.valorTotal)}</td>
    </tr>`;
}
