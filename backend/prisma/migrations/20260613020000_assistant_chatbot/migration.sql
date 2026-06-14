-- CreateTable
CREATE TABLE "AssistantSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "speakerRole" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantSession_userId_role_lastSeenAt_idx" ON "AssistantSession"("userId", "role", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantSession_userId_sessionKey_key" ON "AssistantSession"("userId", "sessionKey");

-- CreateIndex
CREATE INDEX "AssistantMessage_sessionId_createdAt_idx" ON "AssistantMessage"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssistantSession" ADD CONSTRAINT "AssistantSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssistantSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;