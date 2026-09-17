-- AlterTable
ALTER TABLE "condicoes_pagamento" ADD COLUMN     "desativada_manualmente" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "formas_pagamento" ADD COLUMN     "desativada_manualmente" BOOLEAN NOT NULL DEFAULT false;
