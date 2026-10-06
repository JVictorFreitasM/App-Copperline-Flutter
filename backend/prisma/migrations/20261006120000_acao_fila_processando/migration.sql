-- Reserva do idLocal antes de executar a acao (trava de idempotencia).
ALTER TYPE "status_acao_fila" ADD VALUE IF NOT EXISTS 'PROCESSANDO';
