-- Cadastro de cliente enviado ao WK Radar por fila.
CREATE TYPE "status_envio_erp" AS ENUM ('PENDENTE', 'ENVIADO', 'ERRO');

ALTER TABLE "clientes"
  ADD COLUMN "status_envio_erp" "status_envio_erp" NOT NULL DEFAULT 'ENVIADO',
  ADD COLUMN "erro_envio_erp" TEXT,
  ADD COLUMN "payload_envio_erp" JSONB,
  ADD COLUMN "criado_localmente" BOOLEAN NOT NULL DEFAULT false;
