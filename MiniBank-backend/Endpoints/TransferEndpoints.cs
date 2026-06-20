// ==========================================
// 1. NAMESPACES
// ==========================================
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FluentValidation;
using Hangfire;
// Project Specific Namespaces
using MiniBankWallet.Data;
using MiniBankWallet.Models.Ledger;
using MiniBankWallet.DTOs.Transfers;
using MiniBankWallet.Helpers;
using MiniBankWallet.Models.Governance;
using MiniBankWallet.Services;
using Twilio.TwiML.Messaging;

namespace MiniBankWallet.Endpoints;

public static class TransferEndpoints
{
    public static void MapTransferEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/transfers").WithTags("transfers");

        // ==========================================
        // 1. STANDARD TRANSFER ENDPOINT
        // ==========================================
        group.MapPost("/", async (
            [FromHeader(Name = "X-Idempotency-Key")] string? idempotencyKey,
            IValidator<TransferRequest> validator,
            TransferRequest request,
            AppDbContext db,
            IConfiguration config,
            ClaimsPrincipal user) =>
        {
            var validatorResult = await validator.ValidateAsync(request);
            if (!validatorResult.IsValid) return Results.ValidationProblem(validatorResult.ToDictionary());

            var sender = await db.BankAccounts.FirstOrDefaultAsync(a => a.AccountNumber == request.FromAccountNumber);
            var receiver = await db.BankAccounts.FirstOrDefaultAsync(a => a.AccountNumber == request.ToAccountNumber);

            if (sender is null || receiver is null) return Results.NotFound("One or both accounts do not exist.");
            if (sender.Status != "Active" || receiver.Status != "Active") return Results.BadRequest("Both accounts must be 'Active'.");

            // 1. Pull the dynamic values from appsettings.json
            decimal customerLimit = config.GetValue<decimal>("BankSettings:CustomerDailyTransferLimit");
            decimal makerCheckerLimit = config.GetValue<decimal>("BankSettings:MakerCheckerThreshold");

            // 🔥 DRY REFACTOR: 
            var (loggedInUserId, isStaff) = SecurityContext.GetSecurityContext(user);
            var userRole = user.FindFirst(ClaimTypes.Role)?.Value ?? "Customer";

            // Prevent customers from transferring from other people's accounts
            if (!isStaff && loggedInUserId != sender.UserId) return Results.Forbid();
            if (userRole == "Customer" && request.Amount > customerLimit)
            {
                return Results.BadRequest($"Amount limit Exceeded! Customers can only transfer up to {customerLimit:C}. Please visit a branch for larger transfers.");
            }


            // Maker-Checker Interceptor
            if (userRole == "Teller" && request.Amount > makerCheckerLimit)
            {
                var pendingRequest = new ApprovalRequest
                {
                    MakerUserId = loggedInUserId,
                    MakerName = user.FindFirst("name")?.Value ?? "staff",
                    FromAccountId = sender.Id,
                    ToAccountId = receiver.Id,
                    Amount = request.Amount,
                    Status = "Pending",
                    Remark = "Amount limit exceeded",
                    CreatedAt = DateTime.UtcNow
                };

                db.ApprovalRequests.Add(pendingRequest);
                await db.SaveChangesAsync();

                return Results.Accepted($"/api/approvals/{pendingRequest.Id}", new
                {
                    Message = "High-value transfer intercepted. Sent to Admin for Maker-Checker approval.",
                    ApprovalId = pendingRequest.Id
                });
            }

            // Idempotency Check
            if (!string.IsNullOrWhiteSpace(idempotencyKey))
            {
                var existingTransfer = await db.TransactionRecords.FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey);
                if (existingTransfer is not null)
                {
                    return Results.Ok(new TransferResponse(existingTransfer.Id, "Transfer already processed.", existingTransfer.Timestamp));
                }
            }

            // Transfer Execution
            using var transaction = await db.Database.BeginTransactionAsync();
            try
            {
                if (sender.Balance < request.Amount) return Results.BadRequest("Insufficient funds for this transfer.");

                sender.Balance -= request.Amount;
                receiver.Balance += request.Amount;
                sender.Version = Guid.NewGuid();
                receiver.Version = Guid.NewGuid();

                var record = new TransactionRecord
                {
                    FromAccountId = sender.Id,
                    ToAccountId = receiver.Id,
                    Amount = request.Amount,
                    IdempotencyKey = idempotencyKey
                };
                db.TransactionRecords.Add(record);

                var ledgerLines = LedgerHelper.CreateDoubleEntry(
                    record, sender.Id, receiver.Id, request.Amount,
                    $"Transfer to Account ending in {receiver.AccountNumber[^4..]}",
                    $"Transfer from Account ending in {sender.AccountNumber[^4..]}"
                );
                db.LedgerEntries.AddRange(ledgerLines);

                try
                {
                    await db.SaveChangesAsync();
                    await transaction.CommitAsync();
                    return Results.Ok(new TransferResponse(record.Id, "Transfer successful", record.Timestamp));
                }
                catch (DbUpdateException ex)
                {
                    // The databse caut the concurrency race condition 
                    // determine if it was the uniue constrint violation for out Idempotecy key 
                    if (ex.InnerException != null && ex.InnerException.Message.Contains("Dubplicate entry"))
                    {
                        return Results.Conflict(new
                        {
                            Message = "A trasaction with this Idempotency Key is already processing or has completed, Double charge prevented"
                        });
                    }
                    throw;
                }

            }
            catch (DbUpdateConcurrencyException)
            {
                await transaction.RollbackAsync();
                return Results.Conflict(new { Message = "Double-spend prevented! Please retry." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return Results.Problem($"A critical error occurred. No money was moved. Message: {ex}");
            }
        }).RequireAuthorization();

        //############################################################################################################        // 
        // ==========================================
        // 2. BULK UPLOAD ENDPOINT (Clean Architecture)
        // ==========================================
        group.MapPost("/bulk-upload", async (
            [FromHeader(Name = "X-Idempotency-Key")] string? idempotencyKey,
            [FromForm] string fromAccountNumber,
            IFormFile file,
            [FromForm] DateTime cuttOfDate,
            Hangfire.IBackgroundJobClient backgroundJobs,
            AppDbContext db,
            ClaimsPrincipal user) =>
        {
            // valid file checks 
            if (file == null || file.Length == 0) return Results.BadRequest("No file uploaded");
            if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase)) return Results.BadRequest("Only modern .xlsx files are accepted.");

            // BATCH IDEMPOTENCY CHECK 
            // Prevent user from double clicking the file and queueing the file twice
            if (!string.IsNullOrWhiteSpace(idempotencyKey))
            {
                // Ensure the BulkUploadBatch model has a string IdempotencyKey has s string Idempotency properyy added to it 
                var existingBatch = await db.bulkUploadBatches.FirstOrDefaultAsync(b => b.IdempotencyKey == idempotencyKey);
                if (existingBatch != null)
                {
                    return Results.Ok(new { Message = "File already uploaded adn is processing.", BatchId = existingBatch.Id });
                }
            }
            // Fetch Auth Context
            var (loggedInUserId, isStaff) = SecurityContext.GetSecurityContext(user);
            // 1. Create the Pending Batch Record NOW so we have an ID to give the user!
            var uploadBatch = new BulkUploadBatch
            {
                FileName = file.FileName,
                UploadDate = DateTime.UtcNow,
                UploadedByUserId = loggedInUserId,
                Status = "Pending",
                IdempotencyKey = idempotencyKey
            };
            db.bulkUploadBatches.Add(uploadBatch);
            await db.SaveChangesAsync();

            // 1. Save the file temporarily to the server's hard drive
            var tempFolderPath = Path.Combine(Directory.GetCurrentDirectory(), "TempUploads");
            if (!Directory.Exists(tempFolderPath)) Directory.CreateDirectory(tempFolderPath);

            var safeFileName = Path.GetFileName(file.FileName);
            var tempFilePath = Path.Combine(tempFolderPath, $"{Guid.NewGuid()}_{safeFileName}");
            using (var fileStream = new FileStream(tempFilePath, FileMode.Create))
            {
                await file.CopyToAsync(fileStream);
            }

            // 2. Enqueue the Hangfire Background Job! (Pass the string path, NOT the IFormFile)
            backgroundJobs.Enqueue<IBulkProcessingService>(service =>
                service.ProcessPayrollBatchAsync(uploadBatch.Id, tempFilePath, file.FileName, fromAccountNumber, cuttOfDate, loggedInUserId, isStaff));

            // 3. Instantly return to the user! (The browser doesn't wait for the file to process)
            return Results.Accepted("", new
            {
                Message = "File uploaded successfully. Processing has started in the background. Please check your Dashboard for status updates.",
                BatchId = uploadBatch.Id
            });

        })
        .DisableAntiforgery()
        .RequireAuthorization();
        // ##################################################################
        //  BATCH HISTORY -----------------------------------------
        // 1. GET BATCH HISTORY
        group.MapGet("/bulk-upload/batches", async (AppDbContext db, ClaimsPrincipal user) =>
        {
            var (loggedInUserId, isStaff) = SecurityContext.GetSecurityContext(user);

            var query = db.bulkUploadBatches.AsNoTracking().AsQueryable();

            // If not admin/staff, only show their own uploads
            if (!isStaff)
            {
                query = query.Where(b => b.UploadedByUserId == loggedInUserId);
            }

            var batches = await query
                .OrderByDescending(b => b.UploadDate)
                .Take(50) // Limit to recent 50 for performance
                .Select(b => new
                {
                    b.Id,
                    b.FileName,
                    b.UploadDate,
                    b.Status,
                    b.ErrorMessage,
                    HasErrorReport = !string.IsNullOrEmpty(b.ErrorReportFilePath)
                })
                .ToListAsync();

            return Results.Ok(batches);
        }).RequireAuthorization();

        // ###################################################################
        // 2. DOWNLOAD ERROR REPORT
        group.MapGet("/bulk-upload/batches/{id}/report", async (int id, AppDbContext db, ClaimsPrincipal user) =>
        {
            var (loggedInUserId, isStaff) = SecurityContext.GetSecurityContext(user);
            var batch = await db.bulkUploadBatches.FindAsync(id);

            if (batch == null) return Results.NotFound("Batch not found.");
            if (!isStaff && batch.UploadedByUserId != loggedInUserId) return Results.Forbid();
            if (string.IsNullOrEmpty(batch.ErrorReportFilePath) || !File.Exists(batch.ErrorReportFilePath))
                return Results.NotFound("Error report file no longer exists on the server.");

            var fileBytes = await File.ReadAllBytesAsync(batch.ErrorReportFilePath);
            return Results.File(fileBytes, "text/csv", $"Batch_{id}_Errors.csv");
        }).RequireAuthorization();
        // ==========================================
        // 3. CHECK BATCH STATUS
        // ==========================================
        group.MapGet("/bulk-upload/{batchId}/status", async (int batchId, AppDbContext db, ClaimsPrincipal user) =>
        {

            var batch = await db.bulkUploadBatches.FindAsync(batchId);
            if (batch == null) return Results.NotFound();
            var (loggedInUserId, isStaff) = SecurityContext.GetSecurityContext(user);
            if (!isStaff && batch.UploadedByUserId != loggedInUserId)
                return Results.Forbid();

            return Results.Ok(new
            {
                BatchId = batch.Id,
                Status = batch.Status,
                Message = batch.ErrorMessage,
                HasErrorFile = !string.IsNullOrEmpty(batch.ErrorReportFilePath)
            });
        }).RequireAuthorization();

        // ==========================================########################
        // 4. DOWNLOAD ERROR CSV
        // ==========================================
        group.MapGet("/bulk-upload/{batchId}/download-errors", async (int batchId, AppDbContext db, ClaimsPrincipal user) =>
        {
            var batch = await db.bulkUploadBatches.FindAsync(batchId);

            // Security & Existence checks
            if (batch == null || string.IsNullOrEmpty(batch.ErrorReportFilePath))
                return Results.NotFound("No error report available for this batch.");

            var (loggedInUserId, isStaff) = SecurityContext.GetSecurityContext(user);
            if (!isStaff && batch.UploadedByUserId != loggedInUserId)
                return Results.Forbid();

            var absolutePath = Path.IsPathRooted(batch.ErrorReportFilePath)
                 ? batch.ErrorReportFilePath
                 : Path.Combine(Directory.GetCurrentDirectory(), batch.ErrorReportFilePath);

            if (!File.Exists(absolutePath))
                return Results.NotFound($"The file could not be found at: {absolutePath}");
            // Read the file from the hard drive and send it to the browser
            var fileBytes = await File.ReadAllBytesAsync(batch.ErrorReportFilePath);

            return Results.File(
                fileContents: fileBytes,
                contentType: "text/csv",
                fileDownloadName: $"Payroll_Errors_Batch_{batchId}.csv"
            );
        }).RequireAuthorization();
    }
}
