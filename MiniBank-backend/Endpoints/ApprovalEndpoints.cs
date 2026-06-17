
using System.Security.Claims;
using Azure;
using Microsoft.EntityFrameworkCore;
using MiniBankWallet.Data;
using MiniBankWallet.Helpers;
using MiniBankWallet.Models.Ledger;

namespace MiniBankWallet.Endpoints;

// DTO 
public record ResolveApprovalRequest(bool IsApproved, string Remark);
public static class ApprovalEndponts
{
    public static void MapApprovalEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/approvals").RequireAuthorization("AdminOnly").WithTags("Admin Approvals");

        //1. Get all pending request
        group.MapGet("/pending", async (AppDbContext db) =>
        {
            var pendingRequest = await db.ApprovalRequests
                .Where(a => a.Status == "Pending")
                .ToListAsync();
            return Results.Ok(pendingRequest);
        });

        // 2. Approve or reject a specific request 
        group.MapPost("/{id}/resolve", async (
            int id,
            ResolveApprovalRequest request,
            AppDbContext db,
            ClaimsPrincipal user) =>
        {
            var approval = await db.ApprovalRequests.FindAsync(id);
            if (approval is null) return Results.NotFound("Approval request not found.");
            
            if (approval.Status != "Pending")
                return Results.BadRequest(new { Message = $"This request has already been processed. Status: {approval.Status}", Remark = approval.Remark });

            var adminId = int.Parse(user.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            
            // 🔥 EDGE CASE 1: Segregation of Duties (Maker != Checker)
            if (approval.MakerUserId == adminId)
            {
                return Results.BadRequest("Compliance Violation: The Maker of a transfer cannot also be the Checker.");
            }

            approval.CheckerUserId = adminId;
            approval.ReviewedAt = DateTime.UtcNow;

            // Scenario A: Admin rejects it
            if (!request.IsApproved)
            {
                approval.Status = "Rejected";
                approval.Remark = string.IsNullOrWhiteSpace(request.Remark) ? "Rejected by Admin" : request.Remark;
                await db.SaveChangesAsync();
                return Results.Ok(new { Message = $"Transfer {id} was successfully Rejected." });
            }

            // Scenario B: Admin Approves it - Execute the transfer 
            using var transaction = await db.Database.BeginTransactionAsync();
            try
            {
                var sender = await db.BankAccounts.FindAsync(approval.FromAccountId);
                var receiver = await db.BankAccounts.FindAsync(approval.ToAccountId);
                
                // 🔥 EDGE CASE 2: Null and Status Checks
                if (sender is null || receiver is null || sender.Status != "Active" || receiver.Status != "Active")
                {
                    approval.Status = "Failed";
                    approval.Remark = "Failed during approval execution: One or both accounts are missing or inactive.";
                    await db.SaveChangesAsync();
                    await transaction.CommitAsync();
                    return Results.BadRequest("Cannot process. One or both accounts are inactive or deleted.");
                }

                // NSF Check
                if (sender.Balance < approval.Amount)
                {
                    approval.Status = "Failed"; 
                    approval.Remark = "Failed during approval execution: Non-Sufficient Funds (NSF).";
                    await db.SaveChangesAsync();
                    await transaction.CommitAsync();
                    return Results.BadRequest("Sender no longer has enough funds to complete this approved transfer.");
                }

                // Execute Math
                sender.Balance -= approval.Amount;
                receiver.Balance += approval.Amount;
                
                sender.Version = Guid.NewGuid();
                receiver.Version = Guid.NewGuid();

                var record = new TransactionRecord
                {
                    FromAccountId = sender.Id,
                    ToAccountId = receiver.Id,
                    Amount = approval.Amount,
                };
                db.TransactionRecords.Add(record);

                var ledgerLines = LedgerHelper.CreateDoubleEntry(
                    record: record,
                    senderAccountId: sender.Id,
                    receiverAccountId: receiver.Id,
                    amount: approval.Amount,
                    debitDescription: "Approved High-Value Transfer",
                    creditDescription: "Approved High-Value Transfer"
                );
                db.LedgerEntries.AddRange(ledgerLines);

                approval.Status = "Approved";
                approval.Remark = "Transfer Executed Successfully.";

                await db.SaveChangesAsync();
                await transaction.CommitAsync();
                
                return Results.Ok(new { Message = "Transfer Approved and Executed Successfully", TransactionId = record.Id });
            }
            // 🔥 EDGE CASE 3: Admin Race Condition Prevention
            catch (DbUpdateConcurrencyException)
            {
                await transaction.RollbackAsync();
                return Results.Conflict(new { Message = "Another admin is currently modifying these accounts. Please retry." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return Results.Problem($"Critical error during approval execution. {ex.Message}");
            }
        });

        // Rejected requests 
        group.MapGet("/rejected", async (AppDbContext db)
        =>
        {
            var rejectedRequests = await db.ApprovalRequests
            .Where(a => a.Status == "Rejected")
            .ToListAsync();
            return Results.Ok(rejectedRequests);
        });
    }

}