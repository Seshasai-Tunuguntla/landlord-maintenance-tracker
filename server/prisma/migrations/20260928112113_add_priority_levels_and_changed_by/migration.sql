-- AlterEnum
BEGIN;
CREATE TYPE "Priority_new" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
ALTER TABLE "public"."MaintenanceRequest" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "MaintenanceRequest" ALTER COLUMN "priority" TYPE "Priority_new" USING ("priority"::text::"Priority_new");
ALTER TYPE "Priority" RENAME TO "Priority_old";
ALTER TYPE "Priority_new" RENAME TO "Priority";
DROP TYPE "public"."Priority_old";
ALTER TABLE "MaintenanceRequest" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM';
COMMIT;

-- AlterTable
ALTER TABLE "StatusHistoryEntry" ADD COLUMN     "changedById" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "StatusHistoryEntry" ADD CONSTRAINT "StatusHistoryEntry_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
