using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniBankWallet.Migrations
{
    /// <inheritdoc />
    public partial class FixAccountIdSpelling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AccoutId",
                table: "LedgerEntries");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AccoutId",
                table: "LedgerEntries",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }
    }
}
