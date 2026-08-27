-- CreateTable
CREATE TABLE "pedido_historico_status" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "status_anterior" TEXT,
    "status_novo" TEXT NOT NULL,
    "alterado_por" TEXT,
    "alterado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_historico_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pedido_historico_status_pedido_id_idx" ON "pedido_historico_status"("pedido_id");

-- AddForeignKey
ALTER TABLE "pedido_historico_status" ADD CONSTRAINT "pedido_historico_status_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_historico_status" ADD CONSTRAINT "pedido_historico_status_alterado_por_fkey" FOREIGN KEY ("alterado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
