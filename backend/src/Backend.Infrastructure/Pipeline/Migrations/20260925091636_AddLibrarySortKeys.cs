using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Infrastructure.Pipeline.Migrations
{
    /// <inheritdoc />
    public partial class AddLibrarySortKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "added_at",
                table: "master_media",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "release_key",
                table: "master_media",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "added_at",
                table: "master_media");

            migrationBuilder.DropColumn(
                name: "release_key",
                table: "master_media");
        }
    }
}
