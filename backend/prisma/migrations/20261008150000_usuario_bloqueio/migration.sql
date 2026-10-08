-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bloqueado_em" TIMESTAMP(3),
ADD COLUMN     "bloqueado_por_sub" TEXT,
ADD COLUMN     "motivo_bloqueio" TEXT;
