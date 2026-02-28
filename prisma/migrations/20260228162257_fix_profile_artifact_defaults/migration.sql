-- DropForeignKey
ALTER TABLE "ProfileArtifactEvidenceLink" DROP CONSTRAINT "ProfileArtifactEvidenceLink_artifactId_fkey";

-- DropForeignKey
ALTER TABLE "ProfileArtifactEvidenceLink" DROP CONSTRAINT "ProfileArtifactEvidenceLink_spanId_fkey";

-- AlterTable
ALTER TABLE "ProfileArtifact" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "tags" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "ProfileArtifactEvidenceLink" ADD CONSTRAINT "ProfileArtifactEvidenceLink_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ProfileArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileArtifactEvidenceLink" ADD CONSTRAINT "ProfileArtifactEvidenceLink_spanId_fkey" FOREIGN KEY ("spanId") REFERENCES "EvidenceSpan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
