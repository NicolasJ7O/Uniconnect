-- CreateTable
CREATE TABLE "AssistantFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assistantMessageId" TEXT,
    "sessionId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "rating" TEXT NOT NULL DEFAULT 'NOT_USEFUL',
    "comment" TEXT,
    "chunks" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssistantFeedback_userId_assistantMessageId_key" ON "AssistantFeedback"("userId", "assistantMessageId");

-- CreateIndex
CREATE INDEX "AssistantFeedback_rating_createdAt_idx" ON "AssistantFeedback"("rating", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantFeedback_question_idx" ON "AssistantFeedback"("question");

-- AddForeignKey
ALTER TABLE "AssistantFeedback" ADD CONSTRAINT "AssistantFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
