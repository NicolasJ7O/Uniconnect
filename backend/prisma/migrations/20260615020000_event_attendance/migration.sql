-- CreateTable
CREATE TABLE "EventAttendance" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventAttendance_eventId_idx" ON "EventAttendance"("eventId");

-- CreateIndex
CREATE INDEX "EventAttendance_userId_idx" ON "EventAttendance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventAttendance_eventId_userId_key" ON "EventAttendance"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
