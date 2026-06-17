using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniBankWallet.Migrations
{
    /// <inheritdoc />
    public partial class AddApprovalRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BankAccounts_Users_UserID",
                table: "BankAccounts");

            migrationBuilder.RenameColumn(
                name: "UserID",
                table: "BankAccounts",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "IX_BankAccounts_UserID",
                table: "BankAccounts",
                newName: "IX_BankAccounts_UserId");

            migrationBuilder.CreateTable(
                name: "ApprovalRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MakerUserId = table.Column<int>(type: "int", nullable: false),
                    MakerName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FromAccountId = table.Column<int>(type: "int", nullable: false),
                    ToAccountId = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CheckerUserId = table.Column<int>(type: "int", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApprovalRequests", x => x.Id);
                });

            migrationBuilder.AddForeignKey(
                name: "FK_BankAccounts_Users_UserId",
                table: "BankAccounts",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BankAccounts_Users_UserId",
                table: "BankAccounts");

            migrationBuilder.DropTable(
                name: "ApprovalRequests");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "BankAccounts",
                newName: "UserID");

            migrationBuilder.RenameIndex(
                name: "IX_BankAccounts_UserId",
                table: "BankAccounts",
                newName: "IX_BankAccounts_UserID");

            migrationBuilder.AddForeignKey(
                name: "FK_BankAccounts_Users_UserID",
                table: "BankAccounts",
                column: "UserID",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
