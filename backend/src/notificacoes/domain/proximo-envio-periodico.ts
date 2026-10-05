// Regra de recorrencia das mensagens periodicas do admin. Horario SEMPRE em
// America/Sao_Paulo: o Brasil nao tem horario de verao desde 2019, entao o
// fuso e' um offset fixo de -3h e dispensa biblioteca de datas (o container
// roda em UTC, ver comentario em relatorio-diario-notificacao.scheduler.ts).
export type FrequenciaMensagem = 'DIARIA' | 'DIAS_UTEIS' | 'SEMANAL' | 'MENSAL';

export interface RecorrenciaMensagem {
  frequencia: FrequenciaMensagem;
  // "HH:mm" no fuso de Sao Paulo.
  horario: string;
  // 0 (domingo) a 6 (sabado) - obrigatorio quando SEMANAL.
  diaSemana?: number | null;
  // 1 a 31 - obrigatorio quando MENSAL; mes mais curto cai no ultimo dia.
  diaMes?: number | null;
}

const OFFSET_SAO_PAULO_MS = -3 * 60 * 60 * 1000;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
// Cobre o pior caso (MENSAL dia 31 -> proximo mes que tem 31 dias).
const LIMITE_DIAS_BUSCA = 70;

export class RecorrenciaInvalidaError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'RecorrenciaInvalidaError';
  }
}

export function validarRecorrencia(recorrencia: RecorrenciaMensagem): void {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(recorrencia.horario)) {
    throw new RecorrenciaInvalidaError(`Horário inválido: '${recorrencia.horario}' (use HH:mm)`);
  }
  if (recorrencia.frequencia === 'SEMANAL') {
    const dia = recorrencia.diaSemana;
    if (dia === null || dia === undefined || !Number.isInteger(dia) || dia < 0 || dia > 6) {
      throw new RecorrenciaInvalidaError('Frequência semanal exige o dia da semana (0 a 6)');
    }
  }
  if (recorrencia.frequencia === 'MENSAL') {
    const dia = recorrencia.diaMes;
    if (dia === null || dia === undefined || !Number.isInteger(dia) || dia < 1 || dia > 31) {
      throw new RecorrenciaInvalidaError('Frequência mensal exige o dia do mês (1 a 31)');
    }
  }
}

// Primeiro instante ESTRITAMENTE depois de `apos` em que a recorrencia
// dispara. Estritamente depois, pra o job nunca reenviar no mesmo minuto em
// que acabou de enviar.
export function calcularProximoEnvio(recorrencia: RecorrenciaMensagem, apos: Date): Date {
  validarRecorrencia(recorrencia);
  const [hora, minuto] = recorrencia.horario.split(':').map(Number);

  // "Relogio de parede" de Sao Paulo: um Date cujos getters UTC mostram a
  // data/hora local. Todo o calendario abaixo usa so os getters/setters UTC.
  const aposLocalMs = apos.getTime() + OFFSET_SAO_PAULO_MS;
  const inicioDoDiaLocalMs = aposLocalMs - mod(aposLocalMs, MS_POR_DIA);

  for (let dias = 0; dias <= LIMITE_DIAS_BUSCA; dias++) {
    const diaLocalMs = inicioDoDiaLocalMs + dias * MS_POR_DIA;
    const candidatoLocalMs = diaLocalMs + (hora * 60 + minuto) * 60 * 1000;
    if (candidatoLocalMs <= aposLocalMs) continue;
    if (!diaCombina(recorrencia, new Date(diaLocalMs))) continue;
    return new Date(candidatoLocalMs - OFFSET_SAO_PAULO_MS);
  }

  // Inalcancavel com recorrencia valida (validarRecorrencia ja barrou o resto).
  throw new RecorrenciaInvalidaError('Não foi possível calcular o próximo envio');
}

function diaCombina(recorrencia: RecorrenciaMensagem, diaLocal: Date): boolean {
  const diaDaSemana = diaLocal.getUTCDay();
  switch (recorrencia.frequencia) {
    case 'DIARIA':
      return true;
    case 'DIAS_UTEIS':
      return diaDaSemana >= 1 && diaDaSemana <= 5;
    case 'SEMANAL':
      return diaDaSemana === recorrencia.diaSemana;
    case 'MENSAL': {
      const ultimoDiaDoMes = new Date(
        Date.UTC(diaLocal.getUTCFullYear(), diaLocal.getUTCMonth() + 1, 0),
      ).getUTCDate();
      return diaLocal.getUTCDate() === Math.min(recorrencia.diaMes as number, ultimoDiaDoMes);
    }
  }
}

// % do JS devolve negativo pra dividendo negativo; aqui o dividendo e' sempre
// um instante recente, mas o helper evita surpresa em datas antes de 1970.
function mod(valor: number, divisor: number): number {
  return ((valor % divisor) + divisor) % divisor;
}
