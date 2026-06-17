using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniBankWallet.Migrations
{
    /// <inheritdoc />
    public partial class AddReconciliationAndNavProps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_TransactionRecords_FromAccountId",
                table: "TransactionRecords",
                column: "FromAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_TransactionRecords_ToAccountId",
                table: "TransactionRecords",
                column: "ToAccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_TransactionRecords_BankAccounts_FromAccountId",
                table: "TransactionRecords",
                column: "FromAccountId",
                principalTable: "BankAccounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TransactionRecords_BankAccounts_ToAccountId",
                table: "TransactionRecords",
                column: "ToAccountId",
                principalTable: "BankAccounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TransactionRecords_BankAccounts_FromAccountId",
                table: "TransactionRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_TransactionRecords_BankAccounts_ToAccountId",
                table: "TransactionRecords");

            migrationBuilder.DropIndex(
                name: "IX_TransactionRecords_FromAccountId",
                table: "TransactionRecords");

            migrationBuilder.DropIndex(
                name: "IX_TransactionRecords_ToAccountId",
                table: "TransactionRecords");
        }
    }
}
