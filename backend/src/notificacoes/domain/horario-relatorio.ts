const FUSO = 'America/Sao_Paulo';
const FORMATO_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Horario configurado ("HH:MM") ou o padrao quando vazio/invalido - um valor
// digitado errado no painel nunca deve desligar o relatorio em silencio.
export function horarioOuPadrao(configurado: string | undefined, padrao: string): string {
  const valor = configurado?.trim();
  return valor && FORMATO_HORA.test(valor) ? valor : padrao;
}

// true quando `agora` (no fuso de Brasilia) e' dia util (segunda a sexta) e
// bate com o horario "HH:MM". Chamado a cada minuto pelo agendador.
export function ehMomentoDoRelatorio(agora: Date, horario: string): boolean {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora);
  const pega = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  if (pega('weekday') === 'Sat' || pega('weekday') === 'Sun') return false;
  return `${pega('hour')}:${pega('minute')}` === horario;
}
