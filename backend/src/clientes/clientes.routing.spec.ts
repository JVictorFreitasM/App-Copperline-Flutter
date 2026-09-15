import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { ClienteTabelaPrecoService } from '../tabelas-preco/cliente-tabela-preco.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import { VisitasService } from '../visitas/visitas.service';
import { ClienteBoletoService } from './cliente-boleto.service';
import { ClienteEstatisticasService } from './cliente-estatisticas.service';
import { ClienteFinanceiroService } from './cliente-financeiro.service';
import { ClienteLocalizacaoService } from './cliente-localizacao.service';
import { ClienteResumoLlmService } from './cliente-resumo-llm.service';
import { ClienteTimelineService } from './cliente-timeline.service';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';

// Guarda de regressao (OS-BACKEND-XX, "eliminar fragilidade de ordenacao
// de rotas") - "/verificar-conflito" so' funciona por estar declarado
// ANTES de "/:id" (ver comentario no controller). Sobe um app Nest real -
// o bug e' de roteamento HTTP.
describe('ClientesController - ordem de rotas estaticas vs :id', () => {
  let app: INestApplication<App>;
  const clientesService = {
    listar: jest.fn(),
    buscarPorId: jest.fn(),
    verificarConflito: jest.fn().mockResolvedValue({ conflito: false }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ClientesController],
      providers: [
        { provide: ClientesService, useValue: clientesService },
        { provide: ClienteResumoLlmService, useValue: {} },
        { provide: ClienteEstatisticasService, useValue: {} },
        { provide: ClienteFinanceiroService, useValue: {} },
        { provide: ClienteBoletoService, useValue: {} },
        { provide: ClienteTimelineService, useValue: {} },
        { provide: UsuariosService, useValue: {} },
        { provide: VendedorEscopoService, useValue: {} },
        { provide: VisitasService, useValue: {} },
        { provide: ClienteLocalizacaoService, useValue: {} },
        { provide: ClienteTabelaPrecoService, useValue: {} },
        { provide: REDIS_CLIENT, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /clientes/verificar-conflito chama verificarConflito, nao buscarPorId', async () => {
    await request(app.getHttpServer())
      .get('/clientes/verificar-conflito')
      .query({ documento: '12345678900' })
      .expect(200);

    expect(clientesService.verificarConflito).toHaveBeenCalled();
    expect(clientesService.buscarPorId).not.toHaveBeenCalled();
  });
});
