-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('MERCADOLIBRE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK');

-- CreateEnum
CREATE TYPE "ChannelAccountStatus" AS ENUM ('CONNECTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PublicationState" AS ENUM ('DRAFT', 'PUBLISHING', 'PUBLISHED', 'OUTDATED', 'DIVERGED', 'PAUSED', 'REMOVED', 'FAILED');

-- CreateTable
CREATE TABLE "ChannelAccount" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "remoteUserId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "ChannelAccountStatus" NOT NULL DEFAULT 'CONNECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "accountId" TEXT NOT NULL,
    "remoteId" TEXT,
    "state" "PublicationState" NOT NULL DEFAULT 'DRAFT',
    "remoteStatus" TEXT,
    "remoteSubStatus" TEXT,
    "syncedSnapshot" JSONB,
    "syncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationEvent" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelAccount_channel_remoteUserId_key" ON "ChannelAccount"("channel", "remoteUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_carId_channel_accountId_key" ON "Publication"("carId", "channel", "accountId");

-- CreateIndex
CREATE INDEX "Publication_state_idx" ON "Publication"("state");

-- CreateIndex
CREATE INDEX "PublicationEvent_publicationId_createdAt_idx" ON "PublicationEvent"("publicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChannelAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationEvent" ADD CONSTRAINT "PublicationEvent_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
