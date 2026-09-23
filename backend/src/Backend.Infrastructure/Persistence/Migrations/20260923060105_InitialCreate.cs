using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProviderAccounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ProviderType = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    ServerUrl = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    Username = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    EncryptedPassword = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: true),
                    ExpiresAt = table.Column<long>(type: "INTEGER", nullable: true),
                    MaxConnections = table.Column<int>(type: "INTEGER", nullable: true),
                    AllowedOutputFormats = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<long>(type: "INTEGER", nullable: false),
                    LastLoginAt = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProviderAccounts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Profiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    AccountId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    AvatarKey = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    IsKids = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Profiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Profiles_ProviderAccounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "ProviderAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    AccountId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TokenHash = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<long>(type: "INTEGER", nullable: false),
                    ExpiresAt = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserSessions_ProviderAccounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "ProviderAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Profiles_AccountId",
                table: "Profiles",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_ProviderAccounts_ProviderType_ServerUrl_Username",
                table: "ProviderAccounts",
                columns: new[] { "ProviderType", "ServerUrl", "Username" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserSessions_AccountId",
                table: "UserSessions",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_UserSessions_TokenHash",
                table: "UserSessions",
                column: "TokenHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Profiles");

            migrationBuilder.DropTable(
                name: "UserSessions");

            migrationBuilder.DropTable(
                name: "ProviderAccounts");
        }
    }
}
