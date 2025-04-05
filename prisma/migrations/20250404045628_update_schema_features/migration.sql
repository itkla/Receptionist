/*
  Warnings:

  - You are about to drop the column `qrCodeUrl` on the `Shipment` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "ShipmentStatus" ADD VALUE 'RECEIVING';

-- DropForeignKey
ALTER TABLE "Device" DROP CONSTRAINT "Device_shipmentId_fkey";

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "assetTag" TEXT;

-- AlterTable
ALTER TABLE "Shipment" DROP COLUMN "qrCodeUrl",
ADD COLUMN     "recipientEmail" TEXT,
ADD COLUMN     "trackingId" TEXT,
ADD COLUMN     "trackingInfo" JSONB;

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ApiKeyToShipment" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ApiKeyToShipment_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "_ApiKeyToShipment_B_index" ON "_ApiKeyToShipment"("B");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ApiKeyToShipment" ADD CONSTRAINT "_ApiKeyToShipment_A_fkey" FOREIGN KEY ("A") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ApiKeyToShipment" ADD CONSTRAINT "_ApiKeyToShipment_B_fkey" FOREIGN KEY ("B") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
