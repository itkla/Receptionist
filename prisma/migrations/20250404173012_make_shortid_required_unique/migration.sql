/*
  Warnings:

  - A unique constraint covering the columns `[shortId]` on the table `Shipment` will be added. If there are existing duplicate values, this will fail.
  - Made the column `shortId` on table `Shipment` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Shipment" ALTER COLUMN "shortId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shortId_key" ON "Shipment"("shortId");
