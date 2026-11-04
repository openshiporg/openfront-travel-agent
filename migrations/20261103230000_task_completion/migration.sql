-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedBy" TEXT,
ADD COLUMN     "completionNote" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "Task_completedBy_idx" ON "Task"("completedBy");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
