-- CreateTable
CREATE TABLE "CategoryAttributeCache" (
    "categoryId" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryAttributeCache_pkey" PRIMARY KEY ("categoryId")
);
