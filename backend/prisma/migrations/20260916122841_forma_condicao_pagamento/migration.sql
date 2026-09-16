-- CreateTable
CREATE TABLE "formas_pagamento" (
    "id" TEXT NOT NULL,
    "id_externo_erp" TEXT NOT NULL,
    "codigo" TEXT,
    "descricao" TEXT,
    "sincronizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formas_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condicoes_pagamento" (
    "id" TEXT NOT NULL,
    "id_externo_erp" TEXT NOT NULL,
    "codigo" TEXT,
    "nome" TEXT,
    "a_vista" BOOLEAN NOT NULL DEFAULT false,
    "com_entrada" BOOLEAN NOT NULL DEFAULT false,
    "antecipada" BOOLEAN NOT NULL DEFAULT false,
    "validade" TIMESTAMP(3),
    "parcelas" JSONB NOT NULL DEFAULT '[]',
    "sincronizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "condicoes_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "formas_pagamento_id_externo_erp_key" ON "formas_pagamento"("id_externo_erp");

-- CreateIndex
CREATE UNIQUE INDEX "condicoes_pagamento_id_externo_erp_key" ON "condicoes_pagamento"("id_externo_erp");
