using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEpgCache : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EpgProgrammes",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AccountId = table.Column<string>(type: "TEXT", maxLength: 36, nullable: false),
                    ChannelKey = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Start = table.Column<long>(type: "INTEGER", nullable: false),
                    End = table.Column<long>(type: "INTEGER", nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EpgProgrammes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EpgStates",
                columns: table => new
                {
                    AccountId = table.Column<string>(type: "TEXT", maxLength: 36, nullable: false),
                    UpdatedAt = table.Column<long>(type: "INTEGER", nullable: true),
                    LastAttemptAt = table.Column<long>(type: "INTEGER", nullable: true),
                    LastError = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    ProgrammeCount = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EpgStates", x => x.AccountId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EpgProgrammes_AccountId_ChannelKey_Start",
                table: "EpgProgrammes",
                columns: new[] { "AccountId", "ChannelKey", "Start" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EpgProgrammes");

            migrationBuilder.DropTable(
                name: "EpgStates");
        }
    }
}
