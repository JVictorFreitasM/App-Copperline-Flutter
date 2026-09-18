-- AlterTable
ALTER TABLE "configuracao_desconto" ADD COLUMN     "habilitar_aprovacao_por_alcada" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "percentual_alcada_gerencial" DECIMAL(5,2) NOT NULL DEFAULT 50,
ADD COLUMN     "percentual_alcada_supervisao" DECIMAL(5,2) NOT NULL DEFAULT 50;

-- CreateTable
CREATE TABLE "configuracao_orcamento" (
    "id" TEXT NOT NULL,
    "habilitar_criacao_orcamento" BOOLEAN NOT NULL DEFAULT true,
    "permitir_vendedor_transformar_em_pedido" BOOLEAN NOT NULL DEFAULT true,
    "criar_pedido_sugerido_como_orcamento" BOOLEAN NOT NULL DEFAULT true,
    "permitir_alteracao_vendedor_orcamento_criado" BOOLEAN NOT NULL DEFAULT true,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao_rastreio" (
    "id" TEXT NOT NULL,
    "desabilitar_edicao_horario_trabalho_android" BOOLEAN NOT NULL DEFAULT true,
    "habilitar_rastreamento_sabados" BOOLEAN NOT NULL DEFAULT false,
    "habilitar_rastreamento_domingos" BOOLEAN NOT NULL DEFAULT false,
    "horario_inicio_rastreamento" VARCHAR(5) NOT NULL DEFAULT '07:30',
    "horario_termino_rastreamento" VARCHAR(5) NOT NULL DEFAULT '18:00',
    "precisao_minima_metros_gps" INTEGER NOT NULL DEFAULT 50,
    "tempo_minimo_acordar_gps_ms" INTEGER NOT NULL DEFAULT 30000,
    "permitir_registro_com_gps_desabilitado" BOOLEAN NOT NULL DEFAULT false,
    "distancia_maxima_cliente_registro_pedido_metros" INTEGER,
    "distancia_maxima_cliente_registro_visita_metros" INTEGER NOT NULL DEFAULT 50,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_rastreio_pkey" PRIMARY KEY ("id")
);
