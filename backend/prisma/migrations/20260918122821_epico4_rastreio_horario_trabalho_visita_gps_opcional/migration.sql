-- AlterTable
ALTER TABLE "vendedores" ADD COLUMN     "horario_fim_trabalho" VARCHAR(5),
ADD COLUMN     "horario_inicio_trabalho" VARCHAR(5);

-- AlterTable
ALTER TABLE "visitas" ALTER COLUMN "checkin_lat" DROP NOT NULL,
ALTER COLUMN "checkin_lng" DROP NOT NULL;
