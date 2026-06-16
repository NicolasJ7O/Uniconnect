ALTER TABLE "Event" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "EventInvitation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "EventInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventInvitation_token_key" ON "EventInvitation"("token");
CREATE INDEX "EventInvitation_eventId_email_idx" ON "EventInvitation"("eventId", "email");
CREATE INDEX "EventInvitation_status_expiresAt_idx" ON "EventInvitation"("status", "expiresAt");

ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
