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

            migrationBuilder.Sql($@"
        INSERT INTO Users (Email, PasswordHash, Role, OwnerName, MobileNumber, AadharNumber, RequiresPasswordReset)
        VALUES 
        ('admin@minibank.com', ' ', 2, 'System Admin', '9999999999', '000000000000', 0),
        ('shindesharad9325@gmail.com', '$2a$11$fEEGmOMi6AsWtFSa00gRhumTYoxnuj5EDzdgG82TZ0feGzOD1QZmy', 1, 'Sharad Shinde (CTO)', '8888888888', '111111111111', 0),
        ('unitit78@gmail.com', '', 0, 'Test Customer', '7777777777', '222222222222', 0);
    ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM BankAccounts WHERE AccountNumber = 'VAULT001'");
        }
    }
}
