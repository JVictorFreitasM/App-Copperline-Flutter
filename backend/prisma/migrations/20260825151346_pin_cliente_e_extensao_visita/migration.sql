-- AlterEnum
ALTER TYPE "tipo_evento_notificacao" ADD VALUE 'VISITA_CANCELADA';

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "localizacao_definida_em" TIMESTAMP(3),
ADD COLUMN     "localizacao_definida_por_id" TEXT,
ADD COLUMN     "localizacao_lat" DECIMAL(9,6),
ADD COLUMN     "localizacao_lng" DECIMAL(9,6);

-- AlterTable
ALTER TABLE "visitas" ADD COLUMN     "cancelada_em" TIMESTAMP(3),
ADD COLUMN     "distancia_checkin_metros" DECIMAL(10,2),
ADD COLUMN     "distancia_checkout_metros" DECIMAL(10,2),
ADD COLUMN     "foto_checkin_caminho" TEXT,
ADD COLUMN     "motivo_cancelamento" TEXT;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_localizacao_definida_por_id_fkey" FOREIGN KEY ("localizacao_definida_por_id") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
