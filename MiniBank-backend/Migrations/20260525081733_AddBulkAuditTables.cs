using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniBankWallet.Migrations
{
    /// <inheritdoc />
    public partial class AddBulkAuditTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bulkUploadBatches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FileName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UploadDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UploadedByUserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bulkUploadBatches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bulkUploadRows",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BulkUploadBatchId = table.Column<int>(type: "int", nullable: false),
                    TargetAccountNumber = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Quarter = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Flag = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bulkUploadRows", x => x.id);
                    table.ForeignKey(
                        name: "FK_bulkUploadRows_bulkUploadBatches_BulkUploadBatchId",
                        column: x => x.BulkUploadBatchId,
                        principalTable: "bulkUploadBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bulkUploadRows_BulkUploadBatchId",
                table: "bulkUploadRows",
                column: "BulkUploadBatchId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bulkUploadRows");

            migrationBuilder.DropTable(
                name: "bulkUploadBatches");
        }
    }
}
