-- CreateTable
CREATE TABLE "visitas" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "vendedor_id" TEXT NOT NULL,
    "checkin_em" TIMESTAMP(3) NOT NULL,
    "checkin_lat" DECIMAL(9,6) NOT NULL,
    "checkin_lng" DECIMAL(9,6) NOT NULL,
    "checkout_em" TIMESTAMP(3),
    "checkout_lat" DECIMAL(9,6),
    "checkout_lng" DECIMAL(9,6),
    "nota" TEXT,

    CONSTRAINT "visitas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visitas_cliente_id_idx" ON "visitas"("cliente_id");

-- CreateIndex
CREATE INDEX "visitas_vendedor_id_checkout_em_idx" ON "visitas"("vendedor_id", "checkout_em");

-- AddForeignKey
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
