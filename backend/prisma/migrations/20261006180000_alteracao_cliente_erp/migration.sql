-- CreateTable
CREATE TABLE "alteracoes_cliente_erp" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "status_envio_erp" NOT NULL DEFAULT 'PENDENTE',
    "erro" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado_em" TIMESTAMP(3),

    CONSTRAINT "alteracoes_cliente_erp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alteracoes_cliente_erp_cliente_id_criado_em_idx" ON "alteracoes_cliente_erp"("cliente_id", "criado_em");

-- CreateIndex
CREATE INDEX "alteracoes_cliente_erp_status_idx" ON "alteracoes_cliente_erp"("status");

-- AddForeignKey
ALTER TABLE "alteracoes_cliente_erp" ADD CONSTRAINT "alteracoes_cliente_erp_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alteracoes_cliente_erp" ADD CONSTRAINT "alteracoes_cliente_erp_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
