-- CreateTable
CREATE TABLE "coberturas_temporarias" (
    "id" TEXT NOT NULL,
    "vendedor_original_id" TEXT NOT NULL,
    "vendedor_substituto_id" TEXT NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coberturas_temporarias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coberturas_temporarias_vendedor_substituto_id_data_inicio_d_idx" ON "coberturas_temporarias"("vendedor_substituto_id", "data_inicio", "data_fim");

-- AddForeignKey
ALTER TABLE "coberturas_temporarias" ADD CONSTRAINT "coberturas_temporarias_vendedor_original_id_fkey" FOREIGN KEY ("vendedor_original_id") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coberturas_temporarias" ADD CONSTRAINT "coberturas_temporarias_vendedor_substituto_id_fkey" FOREIGN KEY ("vendedor_substituto_id") REFERENCES "vendedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
