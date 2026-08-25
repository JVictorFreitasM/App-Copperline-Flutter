-- CreateTable
CREATE TABLE "vendedores" (
    "id" TEXT NOT NULL,
    "id_externo_erp" TEXT NOT NULL,
    "codigo_integrador" TEXT,
    "codigo" TEXT,
    "nome" TEXT,
    "email" TEXT,
    "inativo" BOOLEAN NOT NULL DEFAULT false,
    "usuario_id" TEXT,
    "sem_correspondencia_usuario" BOOLEAN NOT NULL DEFAULT true,
    "sincronizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendedores_id_externo_erp_key" ON "vendedores"("id_externo_erp");

-- AddForeignKey
ALTER TABLE "vendedores" ADD CONSTRAINT "vendedores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
