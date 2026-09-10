import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../prisma/prisma.service';
import { SolicitacoesDescontoService } from '../solicitacoes-desconto/solicitacoes-desconto.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import { CriarPedidoService } from './criar-pedido.service';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { RelatorioPedidosService } from './relatorio-pedidos.service';

// Guarda de regressao (OS-BACKEND-XX, "eliminar fragilidade de ordenacao
// de rotas") - "/relatorio" so' funciona por estar declarado ANTES de
// "/:id" no controller (ver comentario em pedidos.controller.ts); se
// alguem inverter essa ordem por engano, "/relatorio" passaria a cair no
// handler buscarPorId com id="relatorio". Sobe um app Nest real (nao so'
// chama o metodo direto) porque o bug e' de ROTEAMENTO HTTP, invisivel
// num teste que chama o controller/service em memoria.
describe('PedidosController - ordem de rotas estaticas vs :id', () => {
  let app: INestApplication<App>;
  const pedidosService = { listar: jest.fn(), buscarPorId: jest.fn(), obterHistorico: jest.fn() };
  const relatorioPedidosService = { obter: jest.fn().mockResolvedValue({ periodo: {}, vendedores: [] }) };
  const usuariosService = { obterOuCriarPorSub: jest.fn().mockResolvedValue({ id: 'user-1' }) };
  const vendedorEscopoService = {
    resolverEscopoClientes: jest.fn().mockResolvedValue({ tipo: 'TODOS' }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PedidosController],
      providers: [
        { provide: PedidosService, useValue: pedidosService },
        { provide: CriarPedidoService, useValue: {} },
        { provide: UsuariosService, useValue: usuariosService },
        { provide: VendedorEscopoService, useValue: vendedorEscopoService },
        { provide: RelatorioPedidosService, useValue: relatorioPedidosService },
        { provide: SolicitacoesDescontoService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /pedidos/relatorio chama RelatorioPedidosService, nao PedidosService.buscarPorId', async () => {
    await request(app.getHttpServer()).get('/pedidos/relatorio').expect(200);

    expect(relatorioPedidosService.obter).toHaveBeenCalled();
    expect(pedidosService.buscarPorId).not.toHaveBeenCalled();
  });
});
