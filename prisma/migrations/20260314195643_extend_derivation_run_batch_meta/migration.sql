-- AlterTable
ALTER TABLE "DerivationRun" ADD COLUMN     "messageCount" INTEGER,
ADD COLUMN     "sessionCount" INTEGER,
ADD COLUMN     "windowEnd" TIMESTAMP(3),
ADD COLUMN     "windowStart" TIMESTAMP(3);
