import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ClienteCadastroService } from './cliente-cadastro.service';

// So re-enfileira - nenhuma logica de negocio aqui. Cobre o cliente que ficou
// PENDENTE sem job vivo na fila (Redis perdido, backend reiniciado antes de
// enfileirar, envio desligado e depois ligado). O jobId fixo por cliente
// impede job duplicado enquanto o anterior ainda existe.
@Injectable()
export class ClienteEnvioErpScheduler {
  private readonly logger = new Logger(ClienteEnvioErpScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clienteCadastroService: ClienteCadastroService,
  ) {}

  @Cron('*/10 * * * *')
  async reenfileirarPendentes(): Promise<void> {
    // Margem de 5 min: nao disputa com o job recem-criado pelo proprio POST.
    const limite = new Date(Date.now() - 5 * 60 * 1000);
    const pendentes = await this.prisma.cliente.findMany({
      where: {
        criadoLocalmente: true,
        statusEnvioErp: 'PENDENTE',
        sincronizadoEm: { lt: limite },
      },
      select: { id: true },
      take: 50,
    });
    for (const { id } of pendentes) {
      await this.clienteCadastroService.enfileirarEnvio(id);
    }
    if (pendentes.length > 0) {
      this.logger.log(`${pendentes.length} cliente(s) PENDENTE re-enfileirado(s) para envio ao ERP`);
    }
  }
}
