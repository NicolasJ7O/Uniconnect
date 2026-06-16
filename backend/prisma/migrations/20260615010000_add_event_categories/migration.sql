-- AlterTable
ALTER TABLE "Event" ADD COLUMN "categoryId" TEXT;

-- CreateTable
CREATE TABLE "EventCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventCategory_name_key" ON "EventCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EventCategory_slug_key" ON "EventCategory"("slug");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
