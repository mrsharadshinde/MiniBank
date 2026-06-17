using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniBankWallet.Migrations
{
    /// <inheritdoc />
    public partial class changeUploadBatchForeginKeyIdToBatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_bulkUploadRows_bulkUploadBatches_BulkUploadBatchId",
                table: "bulkUploadRows");

            migrationBuilder.AlterColumn<int>(
                name: "BulkUploadBatchId",
                table: "bulkUploadRows",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddForeignKey(
                name: "FK_bulkUploadRows_bulkUploadBatches_BulkUploadBatchId",
                table: "bulkUploadRows",
                column: "BulkUploadBatchId",
                principalTable: "bulkUploadBatches",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_bulkUploadRows_bulkUploadBatches_BulkUploadBatchId",
                table: "bulkUploadRows");

            migrationBuilder.AlterColumn<int>(
                name: "BulkUploadBatchId",
                table: "bulkUploadRows",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_bulkUploadRows_bulkUploadBatches_BulkUploadBatchId",
                table: "bulkUploadRows",
                column: "BulkUploadBatchId",
                principalTable: "bulkUploadBatches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
