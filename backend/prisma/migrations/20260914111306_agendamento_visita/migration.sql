-- AlterTable
ALTER TABLE "vendedores" ADD COLUMN     "permite_checkin_sem_agendamento" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "agendamentos_visita" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "vendedor_id" TEXT NOT NULL,
    "data_hora_prevista" TIMESTAMP(3) NOT NULL,
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agendamentos_visita_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agendamentos_visita_vendedor_id_data_hora_prevista_idx" ON "agendamentos_visita"("vendedor_id", "data_hora_prevista");

-- CreateIndex
CREATE INDEX "agendamentos_visita_cliente_id_idx" ON "agendamentos_visita"("cliente_id");

-- AddForeignKey
ALTER TABLE "agendamentos_visita" ADD CONSTRAINT "agendamentos_visita_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos_visita" ADD CONSTRAINT "agendamentos_visita_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos_visita" ADD CONSTRAINT "agendamentos_visita_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
