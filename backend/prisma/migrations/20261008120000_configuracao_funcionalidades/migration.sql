-- CreateTable
CREATE TABLE "configuracao_funcionalidades" (
    "id" TEXT NOT NULL,
    "envio_pedidos_habilitado" BOOLEAN NOT NULL DEFAULT true,
    "cadastro_clientes_habilitado" BOOLEAN NOT NULL DEFAULT true,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_funcionalidades_pkey" PRIMARY KEY ("id")
);
