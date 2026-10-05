import { MensagemPeriodicaScheduler } from './mensagem-periodica.scheduler';
import { MENSAGEM_PERIODICA_JOB_NAME } from './notificacao.constants';

describe('MensagemPeriodicaScheduler.agendar', () => {
  it('enfileira o job de executar devidas com jobId por minuto, sem ":" (BullMQ recusa)', async () => {
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    const scheduler = new MensagemPeriodicaScheduler(queue as never);

    await scheduler.agendar();

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [nome, , opcoes] = queue.add.mock.calls[0] as [string, unknown, { jobId: string }];
    expect(nome).toBe(MENSAGEM_PERIODICA_JOB_NAME);
    expect(opcoes.jobId).not.toContain(':');
    expect(opcoes.jobId).toMatch(/-\d+$/);
  });
});
