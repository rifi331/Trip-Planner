-- CreateEnum
CREATE TYPE "CardCategory" AS ENUM ('HISTORICAL', 'UNIQUE', 'INSTAGRAMMABLE', 'TOURIST_ATTRACTION', 'RESTAURANT', 'STREET_FOOD', 'NATURE', 'MUSEUM');

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "CardCategory" NOT NULL,
    "defaultDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "costLevel" INTEGER NOT NULL DEFAULT 2,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItinerarySlot" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "assignedDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItinerarySlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItinerarySlot_cardId_key" ON "ItinerarySlot"("cardId");

-- CreateIndex
CREATE INDEX "ItinerarySlot_tripId_assignedDate_idx" ON "ItinerarySlot"("tripId", "assignedDate");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItinerarySlot" ADD CONSTRAINT "ItinerarySlot_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItinerarySlot" ADD CONSTRAINT "ItinerarySlot_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
