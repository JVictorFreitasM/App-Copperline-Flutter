import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  CLIENTE_ALTERACAO_ERP_JOB_NAME,
  CLIENTE_ENVIO_ERP_QUEUE,
} from './cliente-envio-erp.constants';
import { ClienteEnvioErpService } from './cliente-envio-erp.service';

// concurrency 1: o WK Radar limita requisicoes por segundo, cadastro/edicao
// de cliente nao e' volume, e um por vez mantem as alteracoes na ordem.
@Processor(CLIENTE_ENVIO_ERP_QUEUE, { concurrency: 1 })
export class ClienteEnvioErpProcessor extends WorkerHost {
  constructor(private readonly clienteEnvioErpService: ClienteEnvioErpService) {
    super();
  }

  async process(job: Job<{ clienteId?: string; alteracaoId?: string }>): Promise<void> {
    const tentativasMaximas = job.opts.attempts ?? 1;
    const ultimaTentativa = job.attemptsMade + 1 >= tentativasMaximas;
    if (job.name === CLIENTE_ALTERACAO_ERP_JOB_NAME) {
      await this.clienteEnvioErpService.enviarAlteracao(job.data.alteracaoId!, ultimaTentativa);
      return;
    }
    await this.clienteEnvioErpService.enviar(job.data.clienteId!, ultimaTentativa);
  }
}
