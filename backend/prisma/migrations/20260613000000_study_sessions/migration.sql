-- CreateEnum
CREATE TYPE "FrecuenciaSesionEstudio" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'INTERVAL');

-- CreateEnum
CREATE TYPE "EstadoSesionEstudio" AS ENUM ('SCHEDULED', 'CANCELED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CanalRecordatorioSesion" AS ENUM ('DATABASE', 'WEBSOCKET');

-- CreateTable
CREATE TABLE "SesionEstudioSerie" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subjectId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "baseStartAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "recurrenceConfig" JSONB NOT NULL,
    "reminderMinutes" JSONB,
    "status" "EstadoSesionEstudio" NOT NULL DEFAULT 'SCHEDULED',
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SesionEstudioSerie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesionEstudioBase" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subjectId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "occurrenceIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "EstadoSesionEstudio" NOT NULL DEFAULT 'SCHEDULED',
    "canceledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SesionEstudioBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesionEstudioParticipante" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SesionEstudioParticipante_pkey" PRIMARY KEY ("sessionId","userId")
);

-- CreateTable
CREATE TABLE "SesionEstudioRecordatorio" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "minutesBefore" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "channel" "CanalRecordatorioSesion" NOT NULL DEFAULT 'DATABASE',
    "notificationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SesionEstudioRecordatorio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SesionEstudioSerie_creatorId_baseStartAt_idx" ON "SesionEstudioSerie"("creatorId", "baseStartAt");

-- CreateIndex
CREATE INDEX "SesionEstudioSerie_subjectId_baseStartAt_idx" ON "SesionEstudioSerie"("subjectId", "baseStartAt");

-- CreateIndex
CREATE UNIQUE INDEX "SesionEstudioBase_seriesId_startAt_key" ON "SesionEstudioBase"("seriesId", "startAt");

-- CreateIndex
CREATE INDEX "SesionEstudioBase_creatorId_startAt_idx" ON "SesionEstudioBase"("creatorId", "startAt");

-- CreateIndex
CREATE INDEX "SesionEstudioBase_seriesId_startAt_idx" ON "SesionEstudioBase"("seriesId", "startAt");

-- CreateIndex
CREATE INDEX "SesionEstudioBase_subjectId_startAt_idx" ON "SesionEstudioBase"("subjectId", "startAt");

-- CreateIndex
CREATE INDEX "SesionEstudioBase_status_startAt_idx" ON "SesionEstudioBase"("status", "startAt");

-- CreateIndex
CREATE INDEX "SesionEstudioParticipante_userId_idx" ON "SesionEstudioParticipante"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SesionEstudioRecordatorio_sessionId_minutesBefore_key" ON "SesionEstudioRecordatorio"("sessionId", "minutesBefore");

-- CreateIndex
CREATE INDEX "SesionEstudioRecordatorio_scheduledAt_sentAt_idx" ON "SesionEstudioRecordatorio"("scheduledAt", "sentAt");

-- AddForeignKey
ALTER TABLE "SesionEstudioSerie" ADD CONSTRAINT "SesionEstudioSerie_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionEstudioSerie" ADD CONSTRAINT "SesionEstudioSerie_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionEstudioBase" ADD CONSTRAINT "SesionEstudioBase_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "SesionEstudioSerie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionEstudioBase" ADD CONSTRAINT "SesionEstudioBase_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionEstudioBase" ADD CONSTRAINT "SesionEstudioBase_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionEstudioParticipante" ADD CONSTRAINT "SesionEstudioParticipante_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SesionEstudioBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionEstudioParticipante" ADD CONSTRAINT "SesionEstudioParticipante_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionEstudioRecordatorio" ADD CONSTRAINT "SesionEstudioRecordatorio_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SesionEstudioBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

