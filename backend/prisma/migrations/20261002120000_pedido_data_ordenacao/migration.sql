-- Data efetiva do pedido pra ordenar a listagem (coluna GERADA, nunca escrita pelo app):
-- coalesce(alteracao do Radar, emissao, sincronizado_em). Pedido local recem-criado ainda
-- nao tem as duas primeiras, entao cai em sincronizado_em (= momento da criacao).
ALTER TABLE "pedidos" ADD COLUMN "data_ordenacao" TIMESTAMP(3)
  GENERATED ALWAYS AS (COALESCE("data_hora_ultima_alteracao", "data_emissao", "sincronizado_em")) STORED;

CREATE INDEX "pedidos_data_ordenacao_idx" ON "pedidos" ("data_ordenacao" DESC);
