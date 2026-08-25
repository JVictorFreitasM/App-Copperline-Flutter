-- AlterTable
ALTER TABLE "vendedores" ADD COLUMN     "incompleto" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "clientes_vendedores" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "vendedor_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_vendedores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clientes_vendedores_vendedor_id_idx" ON "clientes_vendedores"("vendedor_id");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_vendedores_cliente_id_vendedor_id_key" ON "clientes_vendedores"("cliente_id", "vendedor_id");

-- AddForeignKey
ALTER TABLE "clientes_vendedores" ADD CONSTRAINT "clientes_vendedores_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes_vendedores" ADD CONSTRAINT "clientes_vendedores_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
