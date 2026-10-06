import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { CLIENTE_ENVIO_ERP_QUEUE } from './cliente-envio-erp.constants';
import { ClienteEnvioErpService } from './cliente-envio-erp.service';

// concurrency 1: o WK Radar limita requisicoes por segundo e cadastro de
// cliente nao e' volume - um por vez basta.
@Processor(CLIENTE_ENVIO_ERP_QUEUE, { concurrency: 1 })
export class ClienteEnvioErpProcessor extends WorkerHost {
  constructor(private readonly clienteEnvioErpService: ClienteEnvioErpService) {
    super();
  }

  async process(job: Job<{ clienteId: string }>): Promise<void> {
    const tentativasMaximas = job.opts.attempts ?? 1;
    const ultimaTentativa = job.attemptsMade + 1 >= tentativasMaximas;
    await this.clienteEnvioErpService.enviar(job.data.clienteId, ultimaTentativa);
  }
}
