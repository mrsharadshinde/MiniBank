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
            TransferRequest request,                                         // Grabs the JSON body
            AppDbContext db,                                                 // Injects the Database connection
            ClaimsPrincipal user) =>                                         // Injects the decoded JWT Token data
        {
            // ----------------------------------------------------
            // LAYER 1: SECURITY (AUTHORIZATION)
            // ----------------------------------------------------
            // Extract the user ID from the JWT token and verify they own the 'FromAccount'
            var loggedInUserId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (loggedInUserId != request.FromAccountId.ToString())
            {
                // The Bouncer kicks them out: You cannot spend someone else's money!
                return Results.Forbid();
            }

            // ----------------------------------------------------
            // LAYER 2: BASIC VALIDATION
            // ----------------------------------------------------
            if (request.Amount <= 0)
                return Results.BadRequest("Transfer amount must be greater than zero.");

            // ----------------------------------------------------
            // LAYER 3: IDEMPOTENCY (FLAKY NETWORK PROTECTION)
            // ----------------------------------------------------
            // If the mobile app sent a tracking key, check if we already moved this money
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

            // ----------------------------------------------------
            // LAYER 4: ACID TRANSACTION (ALL-OR-NOTHING)
            // ----------------------------------------------------
            using var transaction = await db.Database.BeginTransactionAsync();

            try
            {
                // 1. Fetch Accounts
                var sender = await db.Accounts.FindAsync(request.FromAccountId);
                var receiver = await db.Accounts.FindAsync(request.ToAccountId);

                if (sender is null || receiver is null)
                    return Results.NotFound("One or both accounts do not exist.");

                // 2. Check Balance
                if (sender.Balance < request.Amount)
                    return Results.BadRequest("Insufficient funds for this transfer.");

                // 3. Move the Money
                sender.Balance -= request.Amount;
                receiver.Balance += request.Amount;

                // 4. Update Concurrency Tokens (Double-Spend Protection)
                sender.Version = Guid.NewGuid();
                receiver.Version = Guid.NewGuid();

                // 5. Create the Audit Receipt
                var record = new TransactionRecord
                {
                    FromAccountId = sender.Id,
                    ToAccountId = receiver.Id,
                    Amount = request.Amount,
                    IdempotencyKey = idempotencyKey // Save the key to block future retries
                };
                db.TransactionRecords.Add(record);

                // 6. Save and Commit
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

            // ----------------------------------------------------
            // LAYER 5: THE GATEKEEPER
            // ----------------------------------------------------
        }).RequireAuthorization(); // Ensures NO ONE enters this block without a valid JWT Token
    }
}