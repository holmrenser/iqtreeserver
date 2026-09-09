-- CreateTable
CREATE TABLE "iqtreejob" (
    "id" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "alignmentFilename" TEXT NOT NULL,
    "alignmentData" BYTEA NOT NULL,
    "partitionFilename" TEXT,
    "partitionData" BYTEA,
    "submitted" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started" TIMESTAMP(3),
    "finished" TIMESTAMP(3),
    "err" TEXT,
    "log" TEXT,
    "reportRaw" TEXT,
    "reportSummary" JSONB,
    "treeNewick" TEXT,
    "consensusTreeNewick" TEXT,
    "resultsZip" BYTEA,
    "resultsZipBytes" INTEGER,

    CONSTRAINT "iqtreejob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "iqtreejob_id_key" ON "iqtreejob"("id");
