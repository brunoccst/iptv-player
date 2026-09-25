CREATE TABLE "master_media" (
    "id" TEXT NOT NULL CONSTRAINT "PK_master_media" PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "media_kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalized_key" TEXT NOT NULL,
    "year" INTEGER NULL,
    "poster_url" TEXT NULL,
    "rating" REAL NULL,
    "best_quality" TEXT NULL,
    "variant_count" INTEGER NOT NULL,
    "added_at" INTEGER NULL,
    "release_key" INTEGER NULL,
    "updated_at" INTEGER NOT NULL
);


CREATE TABLE "normalization_jobs" (
    "id" INTEGER NOT NULL CONSTRAINT "PK_normalization_jobs" PRIMARY KEY AUTOINCREMENT,
    "account_id" TEXT NOT NULL,
    "media_kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "item_count" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL,
    "error" TEXT NULL,
    "locked_by" TEXT NULL,
    "created_at" INTEGER NOT NULL,
    "started_at" INTEGER NULL,
    "finished_at" INTEGER NULL
);


CREATE TABLE "media_variants" (
    "account_id" TEXT NOT NULL,
    "media_kind" TEXT NOT NULL,
    "stream_id" TEXT NOT NULL,
    "master_id" TEXT NOT NULL,
    "raw_title" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quality" TEXT NULL,
    "source" TEXT NULL,
    "audio_languages" TEXT NOT NULL,
    "audio_tag" TEXT NULL,
    "is_hdr" INTEGER NOT NULL,
    "quality_score" INTEGER NOT NULL,
    "category_id" TEXT NULL,
    "poster_url" TEXT NULL,
    "rating" REAL NULL,
    "container_extension" TEXT NULL,
    CONSTRAINT "PK_media_variants" PRIMARY KEY ("account_id", "media_kind", "stream_id"),
    CONSTRAINT "FK_media_variants_master_media_master_id" FOREIGN KEY ("master_id") REFERENCES "master_media" ("id") ON DELETE CASCADE
);


CREATE INDEX "IX_master_media_account_id_media_kind_title" ON "master_media" ("account_id", "media_kind", "title");


CREATE INDEX "IX_media_variants_account_id_media_kind_category_id" ON "media_variants" ("account_id", "media_kind", "category_id");


CREATE INDEX "IX_media_variants_master_id" ON "media_variants" ("master_id");


CREATE INDEX "IX_normalization_jobs_account_id_media_kind_status" ON "normalization_jobs" ("account_id", "media_kind", "status");


CREATE INDEX "IX_normalization_jobs_status_id" ON "normalization_jobs" ("status", "id");
