
using Microsoft.EntityFrameworkCore;
using MiniBankWallet.Data;
using MiniBankWallet.DTOs.Transfers;
using MiniBankWallet.Helpers;
using MiniBankWallet.Models.Governance;
using MiniBankWallet.Models.Ledger;


namespace MiniBankWallet.Services;

public class BulkProcessingService : IBulkProcessingService
{
    private readonly AppDbContext _db;
    private readonly ExcelProcessingService _excelService;
    private readonly ILogger<BulkProcessingService> _logger;

    public BulkProcessingService(AppDbContext db, ExcelProcessingService excelService, ILogger<BulkProcessingService> logger)
    {
        _db = db;
        _excelService = excelService;
        _logger = logger;
    }

    public async Task ProcessPayrollBatchAsync(int batchId, string filePath, string originalFileName, string fromAccountNumber, DateTime quarterlyCutoff, int loggedInUserId, bool isStaff)
    {
        // 1. Create the Pending Batch Record immediately so the user can track it
        var uploadBatch = await _db.bulkUploadBatches.FindAsync(batchId);
        if (uploadBatch == null) return;
        uploadBatch.Status = "Processing";
        await _db.SaveChangesAsync();

        using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            // 2. Open the temporary file from the hard drive
            using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read);
            var transfers = _excelService.ParsePayrollExcel(stream);

            if (transfers.Count == 0) throw new Exception("No valid records found in the Excel file.");

            // 3. Sender Validation
            var sender = await _db.BankAccounts.FirstOrDefaultAsync(a => a.AccountNumber == fromAccountNumber);
            if (sender is null || sender.Status != "Active") throw new Exception("Sender account is invalid or inactive.");
            if (!isStaff && sender.UserId != loggedInUserId) throw new Exception("Forbidden: You do not own this account.");

            var validationErrors = new List<string>();

            // Pre-load data into memory for high performance
            var targetAccountNumbers = transfers.Select(t => t.ToAccountNumber).Distinct().ToList();
            var receiversDictionary = await _db.BankAccounts
                .Where(a => targetAccountNumbers.Contains(a.AccountNumber))
                .ToDictionaryAsync(a => a.AccountNumber);

            int currentYear = quarterlyCutoff.Year;
            var annualUploads = await _db.bulkUploadRows
                .Include(r => r.BulkUploadBatch)
                .Where(r => r.BulkUploadBatch.UploadedByUserId == loggedInUserId
                    && r.RecordDate.HasValue
                    && r.RecordDate.Value.Year == currentYear
                    && !r.Flag.Contains("Duplicate")
                    && !r.Flag.Contains("Missing"))
                .ToListAsync();

            var seenDbRecordIds = new HashSet<int>();

            int successCount = 0;
            int skippedCount = 0;
            int rowNumber = 0;
            // ==========================================
            // 4. THE VALIDATION ENGINE
            // ==========================================
            foreach (var item in transfers)
            {
                rowNumber++;
                var safeDateExteaction = item.ExtractedDate.HasValue ? item.ExtractedDate.Value : DateTime.UtcNow;
                //string determinedQuarter = $"Q{Math.Ceiling(safeDateExteaction.Month / 3.0)} {safeDateExteaction.Year}";
                // string determinedQuarter = $"Q{Math.Ceiling(DateTime.UtcNow.Month / 3.0)} {DateTime.UtcNow.Year}";
                string determinedQuarter = $"Q{Math.Ceiling((DateTime.UtcNow.Month + 1.27) / 3.0)} {DateTime.UtcNow.Year}";
                string rowFlag = "";
                bool shouldProcessFinances = false;

                if (item.ExtractedDate == null)
                {
                    rowFlag = "Skipped - Malformed Date/Description";
                    validationErrors.Add($"{item.ToAccountNumber},{item.Amount},{item.Description}, Malformed Date or Description without date.");
                }
                else
                {
                    if (!receiversDictionary.TryGetValue(item.ToAccountNumber, out var receiver) || receiver.Status != "Active")
                    {
                        rowFlag = "Skipped - Invalid Receiver Account";
                        validationErrors.Add($"{item.ToAccountNumber},{item.Amount},{item.Description}, Invalid or Inactive Receiver Account.");
                    }
                    else
                    {
                        var existingRecord = annualUploads.FirstOrDefault(r =>
                            r.TargetAccountNumber == item.ToAccountNumber &&
                            r.Amount == item.Amount &&
                            r.RecordDate.HasValue && item.ExtractedDate.HasValue &&
                            r.RecordDate >= item.ExtractedDate.Value.AddDays(-1) &&
                            r.RecordDate <= item.ExtractedDate.Value.AddDays(1));

                        if (existingRecord != null)
                        {
                            seenDbRecordIds.Add(existingRecord.id);
                            rowFlag = $"Skipped - Duplicate old row from: {existingRecord.Quarter}, record date: {existingRecord.RecordDate}, processed on {existingRecord.ProcessedDate:dd-MM-yyyy}";
                        }
                        else if (item.ExtractedDate.Value < quarterlyCutoff)
                        {
                            var safeDate = item.ExtractedDate.Value;
                            string oldQuarter = $"Q{Math.Ceiling(safeDate.Month / 3.0)} {safeDate.Year}";
                            rowFlag = $"Skipped - New record with old date: {safeDate:dd-MM-yyyy} from {oldQuarter}; this record not processed before";
                            validationErrors.Add($"{item.ToAccountNumber},{item.Amount},{item.Description}, New record contains an old date {item.ExtractedDate.Value} from {oldQuarter}.");
                        }
                        else
                        {
                            rowFlag = "Processed - New Record";
                            shouldProcessFinances = true;
                        }

                        if (shouldProcessFinances)
                        {
                            sender.Balance -= item.Amount;
                            receiver.Balance += item.Amount;

                            string rowIdempotencyKey = $"BULK_BATCH_{batchId}_ROW_{rowNumber}";

                            var record = new TransactionRecord
                            {
                                FromAccountId = sender.Id,
                                ToAccountId = receiver.Id,
                                Amount = item.Amount,
                                Timestamp = DateTime.UtcNow,
                                EffectiveDate = item.ExtractedDate.Value,
                                IdempotencyKey = rowIdempotencyKey
                            };
                            _db.TransactionRecords.Add(record);

                            var ledgerLines = LedgerHelper.CreateDoubleEntry(
                                record, sender.Id, receiver.Id, item.Amount,
                                item.Description, "Bulk Payroll Execution"
                            );
                            _db.LedgerEntries.AddRange(ledgerLines);
                        }
                    }
                }

                var auditRow = new BulkUploadRow
                {
                    TargetAccountNumber = item.ToAccountNumber,
                    Amount = item.Amount,
                    Description = item.Description,
                    Quarter = determinedQuarter,
                    Flag = rowFlag,
                    BulkUploadBatch = uploadBatch,
                    RecordDate = item.ExtractedDate,
                    ProcessedDate = DateTime.UtcNow
                    // ProcessedDate = DateTime.UtcNow.AddDays(-64)
                    // ProcessedDate = DateTime.UtcNow.AddDays(+27)
                    // ProcessedDate = DateTime.UtcNow.AddDays(101)
                };
                _db.bulkUploadRows.Add(auditRow);

                if (shouldProcessFinances) successCount++;
                else skippedCount++;
            }

            // ==========================================
            // 5. MISSING RECORDS RECONCILIATION
            // ==========================================
            var missingRecords = annualUploads.Where(r => !seenDbRecordIds.Contains(r.id)).ToList();
            foreach (var missingRow in missingRecords)
            {
                validationErrors.Add($"{missingRow.TargetAccountNumber},{missingRow.Amount},{missingRow.Description},Missing previous record due to mismatch in AccountNo/Amount/Date");
                skippedCount++;
            }

            // ==========================================
            // 6. THE "COAT CHECK" ERROR HANDLER
            // ==========================================
            if (validationErrors.Count != 0)
            {
                // Cancel all DB changes!
                await transaction.RollbackAsync();
                _db.ChangeTracker.Clear();
                // Build the CSV content
                var csvBuilder = new System.Text.StringBuilder();
                csvBuilder.AppendLine("Target Account Number,Amount,Description,Error Reason");
                foreach (var error in validationErrors) csvBuilder.AppendLine(error);

                // 🔥 Save CSV to the Server's Hard Drive
                var errorFolderPath = Path.Combine(Directory.GetCurrentDirectory(), "ErrorReports");
                if (!Directory.Exists(errorFolderPath)) Directory.CreateDirectory(errorFolderPath);

                var errorFileName = $"Batch_{uploadBatch.Id}_Errors.csv";
                var errorFilePath = Path.Combine(errorFolderPath, errorFileName);
                await File.WriteAllTextAsync(errorFilePath, csvBuilder.ToString());

                // 🔥 Update DB with the string path
                
                var failedBatch = await _db.bulkUploadBatches.FindAsync(uploadBatch.Id);
                if (failedBatch != null)
                {
                    failedBatch.Status = "Failed";
                    failedBatch.ErrorMessage = "Validation errors found. Download report for details.";
                    failedBatch.ErrorReportFilePath = errorFilePath;
                    await _db.SaveChangesAsync();
                }

                return; // Stop execution here
            }
            else
            {
                // Check sender balance before committing
                if (sender.Balance < 0) throw new Exception("Insufficient Balance to process the entire batch.");

                // ==========================================
                // 7. SUCCESSFUL COMPLETION
                // ==========================================
                sender.Version = Guid.NewGuid();
                uploadBatch.Status = "Completed";
                uploadBatch.ErrorMessage = null;

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
            }
        } catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("Duplicate entry")== true)
        {
            await transaction.RollbackAsync();
            _logger.LogWarning($"BATCH {batchId} IDGNORED: A trasaction with this row idempotency key already exists. payment retry safely aborted.");
            _db.ChangeTracker.Clear();
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError($"BATCH FAILED: {ex.Message}");
            _db.ChangeTracker.Clear();

            // 🔥 Re-fetch the batch so EF Core tracks it again
            var failedBatch = await _db.bulkUploadBatches.FindAsync(batchId);
            if (failedBatch != null)
            {
                failedBatch.Status = "Failed";
                failedBatch.ErrorMessage = "Critical error during bulk processing: " + ex.Message;
                await _db.SaveChangesAsync();
            }
        }
        finally
        {
            // 🔥 CRITICAL CLEANUP: Always delete the temporary Excel file when finished
            if (File.Exists(filePath))
            {
                try { File.Delete(filePath); }
                catch (Exception ex) { _logger.LogWarning($"Could not delete temp file {filePath}: {ex.Message}"); }
            }
        }
    }

    public Task<BulkProcessResult> ProcessPayrollBatchAsync(IFormFile file, string fromAccountNumber, DateTime quarterlyCutoff, int loggedInUserId, bool isStaff)
    {
        throw new NotImplementedException();
    }
}