-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "accessoriesNote" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "shortLabel" TEXT;
