using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniBankWallet.Migrations
{
    /// <inheritdoc />
    public partial class EnforceIdempotencyKeyTOBatchProcessingModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IdempotencyKey",
                table: "bulkUploadBatches",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IdempotencyKey",
                table: "bulkUploadBatches");
        }
    }
}
