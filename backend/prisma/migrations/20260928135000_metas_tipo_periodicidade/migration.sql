-- CreateEnum
CREATE TYPE "TipoPeriodicidadeMeta" AS ENUM ('MENSAL', 'SEMANAL');

-- CreateEnum
CREATE TYPE "TipoMeta" AS ENUM ('DINHEIRO', 'PESO', 'MARGEM');

-- Renomeia mes_ano -> periodo (preserva dado existente; passa a
-- representar mes "YYYY-MM" OU semana ISO "YYYY-Www" conforme
-- periodicidade abaixo).
ALTER TABLE "metas_vendedor" RENAME COLUMN "mes_ano" TO "periodo";

-- Linha(s) existente(s) ja eram meta mensal em dinheiro - default abaixo
-- faz o backfill sem precisar de UPDATE manual.
ALTER TABLE "metas_vendedor" ADD COLUMN "periodicidade" "TipoPeriodicidadeMeta" NOT NULL DEFAULT 'MENSAL';
ALTER TABLE "metas_vendedor" ADD COLUMN "tipo_meta" "TipoMeta" NOT NULL DEFAULT 'DINHEIRO';

-- Chave unica passa a incluir periodicidade (mensal e semanal podem
-- coexistir pro mesmo vendedor) - tipo_meta fica FORA da chave de
-- proposito, trocar o tipo e' update no mesmo registro, nao um novo.
-- DROP INDEX (nao "DROP CONSTRAINT") - a unique de vendedor_id+mes_ano
-- original foi criada como indice standalone, nao como table constraint
-- (confirmado via pg_constraint/pg_indexes contra o banco real).
DROP INDEX "metas_vendedor_vendedor_id_mes_ano_key";
ALTER TABLE "metas_vendedor" ADD CONSTRAINT "metas_vendedor_vendedor_id_periodicidade_periodo_key" UNIQUE ("vendedor_id", "periodicidade", "periodo");
