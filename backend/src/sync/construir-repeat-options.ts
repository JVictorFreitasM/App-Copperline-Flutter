import type { RepeatOptions } from 'bullmq';
import type { TipoCadenciaSync } from '../../generated/prisma/client';

export interface ConfiguracaoCadencia {
  tipoCadencia: TipoCadenciaSync;
  intervaloMinutos: number | null;
  horarioFixo: string | null;
  diasSemana: number[];
}

// Converte uma ConfiguracaoSync (banco) pro formato que
// Queue.upsertJobScheduler espera - unico lugar que traduz cadencia de
// negocio pra opcao tecnica do BullMQ, pra nao espalhar essa logica entre
// SyncConfigService e o boot (onModuleInit).
export function construirRepeatOptions(
  config: ConfiguracaoCadencia,
): Omit<RepeatOptions, 'key'> {
  switch (config.tipoCadencia) {
    case 'INCREMENTAL':
    case 'CONFIGURAVEL': {
      if (!config.intervaloMinutos) {
        throw new Error(
          `intervaloMinutos e obrigatorio para tipoCadencia '${config.tipoCadencia}'`,
        );
      }
      return { every: config.intervaloMinutos * 60_000 };
    }
    case 'INCREMENTAL_NOTURNO':
    case 'JANELA_FIXA_DIARIA': {
      if (!config.horarioFixo) {
        throw new Error(
          `horarioFixo e obrigatorio para tipoCadencia '${config.tipoCadencia}'`,
        );
      }
      return { pattern: construirCronPattern(config.horarioFixo, config.diasSemana) };
    }
  }
}

// "00:00" + [] -> "0 0 * * *" (todo dia); "00:00" + [1,3,5] -> "0 0 * * 1,3,5"
// (mesma sintaxe cron que os @Cron fixos de SyncScheduler ja usam).
function construirCronPattern(horarioFixo: string, diasSemana: number[]): string {
  const [horaTexto, minutoTexto] = horarioFixo.split(':');
  const hora = Number(horaTexto);
  const minuto = Number(minutoTexto);
  if (
    !Number.isInteger(hora) ||
    !Number.isInteger(minuto) ||
    hora < 0 ||
    hora > 23 ||
    minuto < 0 ||
    minuto > 59
  ) {
    throw new Error(`horarioFixo '${horarioFixo}' invalido - esperado "HH:mm"`);
  }

  const diasCron = diasSemana.length > 0 ? diasSemana.join(',') : '*';
  return `${minuto} ${hora} * * ${diasCron}`;
}
