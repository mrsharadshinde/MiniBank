using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniBankWallet.Migrations
{
    /// <inheritdoc />
    public partial class SeedVaultAccount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            int adminUserId = 1; 

            migrationBuilder.Sql($@"
                INSERT INTO BankAccounts (AccountNumber, AccountType, Balance, Status, CreatedAt, UpdatedAt, UserId, Version)
                VALUES ('VAULT001', 4, 0.00, 'Active', GETUTCDATE(), GETUTCDATE(), {adminUserId}, NEWID());
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM BankAccounts WHERE AccountNumber = 'VAULT001'");
        }
    }
}
