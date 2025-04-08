-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "notifyEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];
