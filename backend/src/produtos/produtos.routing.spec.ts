import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { FavoritosService } from '../notificacoes/favoritos.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ProdutoCalculoService } from './produto-calculo.service';
import { ProdutoManualService } from './produto-manual.service';
import { ProdutosController } from './produtos.controller';
import { ProdutosRupturaService } from './produtos-ruptura.service';
import { ProdutosService } from './produtos.service';

// Guarda de regressao (OS-BACKEND-XX, "eliminar fragilidade de ordenacao
// de rotas") - "/favoritos" e "/ruptura-prevista" so' funcionam por
// estarem declarados ANTES de "/:id" (ver comentarios no controller).
// Sobe um app Nest real - o bug e' de roteamento HTTP, nao de logica de
// service.
describe('ProdutosController - ordem de rotas estaticas vs :id', () => {
  let app: INestApplication<App>;
  const produtosService = { listar: jest.fn(), buscarPorId: jest.fn() };
  const favoritosService = { listar: jest.fn().mockResolvedValue([]) };
  const usuariosService = { obterOuCriarPorSub: jest.fn().mockResolvedValue({ id: 'user-1' }) };
  const produtosRupturaService = { calcular: jest.fn().mockResolvedValue([]) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProdutosController],
      providers: [
        { provide: ProdutosService, useValue: produtosService },
        { provide: FavoritosService, useValue: favoritosService },
        { provide: UsuariosService, useValue: usuariosService },
        { provide: ProdutosRupturaService, useValue: produtosRupturaService },
        { provide: ProdutoCalculoService, useValue: {} },
        { provide: ProdutoManualService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /produtos/favoritos chama FavoritosService, nao ProdutosService.buscarPorId', async () => {
    await request(app.getHttpServer()).get('/produtos/favoritos').expect(200);

    expect(favoritosService.listar).toHaveBeenCalled();
    expect(produtosService.buscarPorId).not.toHaveBeenCalled();
  });

  it('GET /produtos/ruptura-prevista chama ProdutosRupturaService, nao ProdutosService.buscarPorId', async () => {
    await request(app.getHttpServer()).get('/produtos/ruptura-prevista').expect(200);

    expect(produtosRupturaService.calcular).toHaveBeenCalled();
    expect(produtosService.buscarPorId).not.toHaveBeenCalled();
  });
});
