// ==========================================
// 1. NAMESPACES
// ==========================================
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

// Project Specific Namespaces
using MiniBankWallet.Data;
using MiniBankWallet.Models;
using MiniBankWallet.DTOs.Transfers;
using FluentValidation;
using MiniBankWallet.Helpers;

namespace MiniBankWallet.Endpoints;

public static class TransferEndpoints
{
    public static void MapTransferEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/transfers");

        // ==========================================
        // TRANSFER ENDPOINT (POST /api/transfers)
        // ==========================================
        group.MapPost("/", async (
            [FromHeader(Name = "X-Idempotency-Key")] string? idempotencyKey, // Grabs the retry key from the HTTP Header
            IValidator<TransferRequest> validator,
            TransferRequest request,                                         // Grabs the JSON body
            AppDbContext db,                                                 // Injects the Database connection
            ClaimsPrincipal user) =>                                         // Injects the decoded JWT Token data
        {
            
            var validatorResult = await validator.ValidateAsync(request);
            if(!validatorResult.IsValid) return Results.ValidationProblem(validatorResult.ToDictionary());

            var sender = await db.Accounts.FirstOrDefaultAsync(a => a.AccountNumber == request.FromAccountNumber);
            var receiver = await db.Accounts.FirstOrDefaultAsync(a => a.AccountNumber == request.ToAccountNumber);

            if (sender is null || receiver is null)
                return Results.NotFound("One or both accounts not exist.");

            if (sender.Status != "Active" || receiver.Status != "Active") 
                return Results.BadRequest("Both the accounts must be 'Active' to perform transfer ");
            var loggedInUserId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (loggedInUserId != sender.Id.ToString())
            {
                // The Bouncer kicks them out: You cannot spend someone else's money!
                return Results.Forbid();
            }

            if (!string.IsNullOrWhiteSpace(idempotencyKey))
            {
                var existingTransfer = await db.TransactionRecords
                    .FirstOrDefaultAsync(t => t.IdempotencyKey == idempotencyKey);

                if (existingTransfer is not null)
                {
                    // Money was already moved! Return the old receipt without touching the database.
                    return Results.Ok(new TransferResponse(
                        existingTransfer.Id,
                        "Transfer already processed successfully (Idempotent Retry).",
                        existingTransfer.Timestamp));
                }
            }

            using var transaction = await db.Database.BeginTransactionAsync();

            try
            {
                if (sender.Balance < request.Amount)
                    return Results.BadRequest("Insufficient funds for this transfer.");

                sender.Balance -= request.Amount;
                receiver.Balance += request.Amount;
                sender.Version = Guid.NewGuid();
                receiver.Version = Guid.NewGuid();

                // Master Transaction  Audit Receipt 
                var record = new TransactionRecord
                {
                    FromAccountId = sender.Id,
                    ToAccountId = receiver.Id,
                    Amount = request.Amount,
                    IdempotencyKey = idempotencyKey
                };
                db.TransactionRecords.Add(record);

                // CREATE the double-Entry Ledger Lines 

                var ledgerLines = LedgerHelper.CreateDoubleEntry(
                    record: record,
                    senderAccountId: sender.Id,
                    receiverAccountId: receiver.Id,
                    amount: request.Amount,
                    debitDescription: $"Transfer to Account ending in {receiver.AccountNumber[^4..]}",
                    creditDescription: $"Transfer from Account ending in {sender.AccountNumber[^4..]}"
                );
                db.LedgerEntries.AddRange(ledgerLines);

                Console.WriteLine($"[for sender] Your account ending with ******{sender.AccountNumber[^4..]} is debited with {request.Amount} \nwith transaction Id: {record.Id}");
                Console.WriteLine($"[for receiver] Your account ending with *****{receiver.AccountNumber[^4..]} is credited with {request.Amount} \nwith transaction Id: {record.Id}");

                //  Save and Commit
                await db.SaveChangesAsync();
                await transaction.CommitAsync();

                return Results.Ok(new TransferResponse(record.Id, "Transfer successful", record.Timestamp));
            }
            catch (DbUpdateConcurrencyException)
            {
                // CONCURRENCY TRIGGERED: Two requests tried to move money at the exact same millisecond.
                await transaction.RollbackAsync();
                return Results.Conflict(new { Message = "Double-spend prevented! Please retry." });
            }
            catch (Exception ex)
            {
                // FATAL CRASH: Database died or server failed. Roll everything back so no money is lost.
                await transaction.RollbackAsync();
                Console.WriteLine($"FATAL TRANSFER ERROR: {ex.Message}");
                return Results.Problem("A critical error occurred. No money was moved.");
            }
        }).RequireAuthorization(); // Ensures NO ONE enters this block without a valid JWT Token
    }
}