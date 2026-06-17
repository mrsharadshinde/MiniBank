using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniBankWallet.Migrations
{
    /// <inheritdoc />
    public partial class SwitchToEnumAccountType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ledgerEntries_Accounts_AccountId",
                table: "ledgerEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_ledgerEntries_TransactionRecords_TransactionId",
                table: "ledgerEntries");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ledgerEntries",
                table: "ledgerEntries");

            migrationBuilder.RenameTable(
                name: "ledgerEntries",
                newName: "LedgerEntries");

            migrationBuilder.RenameIndex(
                name: "IX_ledgerEntries_TransactionId",
                table: "LedgerEntries",
                newName: "IX_LedgerEntries_TransactionId");

            migrationBuilder.RenameIndex(
                name: "IX_ledgerEntries_AccountId",
                table: "LedgerEntries",
                newName: "IX_LedgerEntries_AccountId");

            migrationBuilder.AddColumn<string>(
                name: "AccountType",
                table: "Accounts",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddPrimaryKey(
                name: "PK_LedgerEntries",
                table: "LedgerEntries",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_LedgerEntries_Accounts_AccountId",
                table: "LedgerEntries",
                column: "AccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_LedgerEntries_TransactionRecords_TransactionId",
                table: "LedgerEntries",
                column: "TransactionId",
                principalTable: "TransactionRecords",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LedgerEntries_Accounts_AccountId",
                table: "LedgerEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_LedgerEntries_TransactionRecords_TransactionId",
                table: "LedgerEntries");

            migrationBuilder.DropPrimaryKey(
                name: "PK_LedgerEntries",
                table: "LedgerEntries");

            migrationBuilder.DropColumn(
                name: "AccountType",
                table: "Accounts");

            migrationBuilder.RenameTable(
                name: "LedgerEntries",
                newName: "ledgerEntries");

            migrationBuilder.RenameIndex(
                name: "IX_LedgerEntries_TransactionId",
                table: "ledgerEntries",
                newName: "IX_ledgerEntries_TransactionId");

            migrationBuilder.RenameIndex(
                name: "IX_LedgerEntries_AccountId",
                table: "ledgerEntries",
                newName: "IX_ledgerEntries_AccountId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ledgerEntries",
                table: "ledgerEntries",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ledgerEntries_Accounts_AccountId",
                table: "ledgerEntries",
                column: "AccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ledgerEntries_TransactionRecords_TransactionId",
                table: "ledgerEntries",
                column: "TransactionId",
                principalTable: "TransactionRecords",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
