import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { EstoqueController } from './estoque.controller';
import { EstoqueService } from './estoque.service';

// Guarda de regressao (OS-BACKEND-XX, "eliminar fragilidade de ordenacao
// de rotas") - "/mais-pedidos" so' funciona por estar declarado ANTES de
// "/:identificador" (ver comentario no controller). Sobe um app Nest
// real - o bug e' de roteamento HTTP.
describe('EstoqueController - ordem de rotas estaticas vs :identificador', () => {
  let app: INestApplication<App>;
  const estoqueService = {
    obterMaisPedidos: jest.fn().mockResolvedValue([]),
    consultarPorIdentificador: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EstoqueController],
      providers: [
        { provide: EstoqueService, useValue: estoqueService },
        { provide: REDIS_CLIENT, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /estoque/mais-pedidos chama obterMaisPedidos, nao consultarPorIdentificador', async () => {
    await request(app.getHttpServer()).get('/estoque/mais-pedidos').expect(200);

    expect(estoqueService.obterMaisPedidos).toHaveBeenCalled();
    expect(estoqueService.consultarPorIdentificador).not.toHaveBeenCalled();
  });
});
