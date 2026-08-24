-- CreateTable
CREATE TABLE "configuracao_llm" (
    "id" TEXT NOT NULL,
    "provedor" TEXT NOT NULL DEFAULT 'openrouter',
    "api_key" TEXT,
    "modelo" TEXT NOT NULL DEFAULT 'anthropic/claude-opus-5',
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_llm_pkey" PRIMARY KEY ("id")
);
