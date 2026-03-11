-- CreateTable
CREATE TABLE "BoxScanEvent" (
    "id" SERIAL NOT NULL,
    "retailerId" INTEGER NOT NULL,
    "manufacturerId" INTEGER NOT NULL,
    "boxId" INTEGER NOT NULL,
    "totalProducts" INTEGER NOT NULL,
    "verifiedProducts" INTEGER NOT NULL,
    "soldProducts" INTEGER NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoxScanEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BoxScanEvent"
ADD CONSTRAINT "BoxScanEvent_retailerId_fkey"
FOREIGN KEY ("retailerId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxScanEvent"
ADD CONSTRAINT "BoxScanEvent_boxId_fkey"
FOREIGN KEY ("boxId") REFERENCES "Box"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "BoxScanEvent_retailerId_scannedAt_idx"
ON "BoxScanEvent"("retailerId", "scannedAt");

-- CreateIndex
CREATE INDEX "BoxScanEvent_manufacturerId_boxId_idx"
ON "BoxScanEvent"("manufacturerId", "boxId");
