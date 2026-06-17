using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MiniBankWallet.Data;
using MiniBankWallet.Models.Ledger;
using MiniBankWallet.DTOs.PayLoads;
using MiniBankWallet.Helpers; // 🔥 Required for LedgerHelper

namespace MiniBankWallet.Endpoints;

public static class TellerEndpoints
{
    public static void MapTellerEndpoints(this IEndpointRouteBuilder app)
    {
        var tellerGroup = app.MapGroup("/api/teller").RequireAuthorization("StaffOnly").WithTags("Teller Jobs- CTO");

        // ==========================================
        // 1. CASH DEPOSIT & WITHDRAWAL ROUTES
        // ==========================================
        // Notice how clean the routes are now! They both just call the helper method.
        tellerGroup.MapPost("/deposit", async (CashTransactionRequest request, AppDbContext db, ClaimsPrincipal user) =>
            await ProcessOtcTransaction(request, db, user, isDeposit: true));

        tellerGroup.MapPost("/withdraw", async (CashTransactionRequest request, AppDbContext db, ClaimsPrincipal user) =>
            await ProcessOtcTransaction(request, db, user, isDeposit: false));
    }

    // ==========================================
    // 2. THE UNIFIED TRANSACTION ENGINE (DRY)
    // ==========================================
    private static async Task<IResult> ProcessOtcTransaction(
        CashTransactionRequest request, 
        AppDbContext db, 
        ClaimsPrincipal user, 
        bool isDeposit)
    {
        if (request.Amount <= 0) return Results.BadRequest("Amount must be greater than zero.");

        var tellerId = int.Parse(user.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            var customer = await db.BankAccounts.FirstOrDefaultAsync(a => a.AccountNumber == request.AccountNumber);
            if (customer == null) return Results.NotFound("Customer account not found.");
            if (customer.Status != "Active") return Results.BadRequest($"Cannot process. Account status is: {customer.Status}");

            // 🔥 THE ENTERPRISE FIX: Fetch the internal Bank Vault account
            var vault = await db.BankAccounts.FirstOrDefaultAsync(a => a.AccountNumber == "VAULT001");
            if (vault == null) return Results.Problem("System Error: Central Vault account is missing from the database.");

            // Check for Non-Sufficient Funds on withdrawals
            if (!isDeposit && customer.Balance < request.Amount) 
                return Results.BadRequest("Non-Sufficient Funds (NSF).");

            // 1. Update Balances (Money moves between Vault and Customer)
            if (isDeposit)
            {
                customer.Balance += request.Amount;
                vault.Balance += request.Amount; // The bank's physical cash vault goes up
            }
            else
            {
                customer.Balance -= request.Amount;
                vault.Balance -= request.Amount; // The bank's physical cash vault goes down
            }
            
            customer.Version = Guid.NewGuid();
            vault.Version = Guid.NewGuid();

            // 2. Create the Transaction Record (Fixes the 'null' ID error!)
            var record = new TransactionRecord
            {
                FromAccountId = isDeposit ? vault.Id : customer.Id,
                ToAccountId = isDeposit ? customer.Id : vault.Id,
                Amount = request.Amount,
                Timestamp = DateTime.UtcNow,
                EffectiveDate = DateTime.UtcNow
            };
            db.TransactionRecords.Add(record);
            await db.SaveChangesAsync(); // Save to get the generated record.Id

            // 3. Create Balanced Ledger Entries (Fixes the missing 'Type' error!)
            var description = string.IsNullOrWhiteSpace(request.Description) 
                ? (isDeposit ? "OTC Cash Deposit" : "OTC Cash Withdrawal") 
                : request.Description;

            // We reuse the exact same helper method you built for transfers!
            var ledgerLines = LedgerHelper.CreateDoubleEntry(
                record: record,
                senderAccountId: record.FromAccountId, // vault.Id or customer.Id
                receiverAccountId: record.ToAccountId, // customer.Id or vault.Id
                amount: request.Amount,
                debitDescription: $"Teller ID {tellerId} - {description}",
                creditDescription: $"Teller ID {tellerId} - {description}"
            );
            
            db.LedgerEntries.AddRange(ledgerLines);

            await db.SaveChangesAsync();
            await transaction.CommitAsync();

            return Results.Ok(new { 
                Message = $"{(isDeposit ? "Deposit" : "Withdrawal")} successful.", 
                NewBalance = customer.Balance,
                TransactionId = record.Id 
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return Results.Problem($"Critical error processing OTC transaction: {ex.Message}");
        }
    }
}