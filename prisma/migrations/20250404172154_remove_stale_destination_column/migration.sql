/*
  Warnings:

  - You are about to drop the column `destination` on the `Shipment` table. All the data in the column will be lost.
  - Made the column `locationId` on table `Shipment` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "ShipmentStatus" ADD VALUE 'RECEIVED';

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_locationId_fkey";

-- AlterTable
ALTER TABLE "Shipment" DROP COLUMN "destination",
ALTER COLUMN "locationId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
