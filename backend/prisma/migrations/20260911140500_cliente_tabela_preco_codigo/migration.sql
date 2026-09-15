-- Tabela recriada do zero (sem dado ainda, criada na migration anterior
-- na mesma sessao) - troca de tabelaPrecoId (FK) pra codigo (String),
-- ver comentario no schema.prisma sobre o problema de bootstrap que a FK
-- causava.
DROP TABLE "clientes_tabelas_preco";

CREATE TABLE "clientes_tabelas_preco" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_tabelas_preco_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clientes_tabelas_preco_cliente_id_codigo_key" ON "clientes_tabelas_preco"("cliente_id", "codigo");

ALTER TABLE "clientes_tabelas_preco" ADD CONSTRAINT "clientes_tabelas_preco_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
