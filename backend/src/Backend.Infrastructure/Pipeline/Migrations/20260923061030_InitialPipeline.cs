using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Infrastructure.Pipeline.Migrations
{
    /// <inheritdoc />
    public partial class InitialPipeline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "master_media",
                columns: table => new
                {
                    id = table.Column<string>(type: "TEXT", nullable: false),
                    account_id = table.Column<string>(type: "TEXT", nullable: false),
                    media_kind = table.Column<string>(type: "TEXT", nullable: false),
                    title = table.Column<string>(type: "TEXT", nullable: false),
                    normalized_key = table.Column<string>(type: "TEXT", nullable: false),
                    year = table.Column<int>(type: "INTEGER", nullable: true),
                    poster_url = table.Column<string>(type: "TEXT", nullable: true),
                    rating = table.Column<double>(type: "REAL", nullable: true),
                    best_quality = table.Column<string>(type: "TEXT", nullable: true),
                    variant_count = table.Column<int>(type: "INTEGER", nullable: false),
                    updated_at = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_master_media", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "normalization_jobs",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    account_id = table.Column<string>(type: "TEXT", nullable: false),
                    media_kind = table.Column<string>(type: "TEXT", nullable: false),
                    status = table.Column<string>(type: "TEXT", nullable: false),
                    payload = table.Column<string>(type: "TEXT", nullable: false),
                    item_count = table.Column<int>(type: "INTEGER", nullable: false),
                    attempts = table.Column<int>(type: "INTEGER", nullable: false),
                    error = table.Column<string>(type: "TEXT", nullable: true),
                    locked_by = table.Column<string>(type: "TEXT", nullable: true),
                    created_at = table.Column<long>(type: "INTEGER", nullable: false),
                    started_at = table.Column<long>(type: "INTEGER", nullable: true),
                    finished_at = table.Column<long>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_normalization_jobs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "media_variants",
                columns: table => new
                {
                    account_id = table.Column<string>(type: "TEXT", nullable: false),
                    media_kind = table.Column<string>(type: "TEXT", nullable: false),
                    stream_id = table.Column<string>(type: "TEXT", nullable: false),
                    master_id = table.Column<string>(type: "TEXT", nullable: false),
                    raw_title = table.Column<string>(type: "TEXT", nullable: false),
                    label = table.Column<string>(type: "TEXT", nullable: false),
                    quality = table.Column<string>(type: "TEXT", nullable: true),
                    source = table.Column<string>(type: "TEXT", nullable: true),
                    audio_languages = table.Column<string>(type: "TEXT", nullable: false),
                    audio_tag = table.Column<string>(type: "TEXT", nullable: true),
                    is_hdr = table.Column<bool>(type: "INTEGER", nullable: false),
                    quality_score = table.Column<int>(type: "INTEGER", nullable: false),
                    category_id = table.Column<string>(type: "TEXT", nullable: true),
                    poster_url = table.Column<string>(type: "TEXT", nullable: true),
                    rating = table.Column<double>(type: "REAL", nullable: true),
                    container_extension = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_media_variants", x => new { x.account_id, x.media_kind, x.stream_id });
                    table.ForeignKey(
                        name: "FK_media_variants_master_media_master_id",
                        column: x => x.master_id,
                        principalTable: "master_media",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_master_media_account_id_media_kind_title",
                table: "master_media",
                columns: new[] { "account_id", "media_kind", "title" });

            migrationBuilder.CreateIndex(
                name: "IX_media_variants_account_id_media_kind_category_id",
                table: "media_variants",
                columns: new[] { "account_id", "media_kind", "category_id" });

            migrationBuilder.CreateIndex(
                name: "IX_media_variants_master_id",
                table: "media_variants",
                column: "master_id");

            migrationBuilder.CreateIndex(
                name: "IX_normalization_jobs_account_id_media_kind_status",
                table: "normalization_jobs",
                columns: new[] { "account_id", "media_kind", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_normalization_jobs_status_id",
                table: "normalization_jobs",
                columns: new[] { "status", "id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "media_variants");

            migrationBuilder.DropTable(
                name: "normalization_jobs");

            migrationBuilder.DropTable(
                name: "master_media");
        }
    }
}
