using MiniBankWallet.Data;
using MiniBankWallet.Models;
using MiniBankWallet.DTOs.Accounts;
using MiniBankWallet.Mappers;
using Microsoft.EntityFrameworkCore;

using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using System.Formats.Tar;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace MiniBankWallet.Endpoints;

public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        // creat the root group 
        var group = app.MapGroup("/api/accounts");

        // create the accound
        group.MapPost("/", async (CreateAccountRequest request, AppDbContext db) =>
        {
            var account = new Account
            {
                OwnerName = request.OwnerName,
                Balance = request.InitialDeposit
            };

            db.Accounts.Add(account);
            await db.SaveChangesAsync();

            return Results.Ok(account.ToAccountResponse());
        });

        // Get account list 
        group.MapGet("/", async (AppDbContext db) =>
        {
            var accounts = await db.Accounts
                .AsNoTracking()
                .ToListAsync();
            var response = accounts.Select(a => a.ToAccountResponse());
            return Results.Ok(response);
        });

        // get specific account 
        group.MapGet("/{id}", async (int id, AppDbContext db) =>
        {
            Account? account  = await db.Accounts
                .FindAsync(id);

            return account is null ? 
                Results.NotFound() : 
                Results.Ok(account.ToAccountResponse());
        });

        // Check balance 
        group.MapGet("/{id}/balance", async (int id, AppDbContext db) =>
        {
            decimal? balance = await db.Accounts
                .Where(a => a.Id == id)
                .Select(a => (decimal?)a.Balance)
                .FirstOrDefaultAsync();

            return balance is null ?
                Results.NotFound("Account not found") :
                Results.Ok(new { AccountId = id, Balance = balance });
        });

        // ===================================================
        // Pagination Trasaction history 
        // GET/api/accounts/{id} Trasactions?page=1&pageSize=10
        group.MapGet("/{id}/trasactions", async (
            int id,
            [FromQuery] int page,
            [FromQuery] int pageSize, 
            AppDbContext db,
            ClaimsPrincipal user) =>
            {
                // set default if user forget to send them 
                page = page < 1 ? 1: page;
                pageSize = pageSize < 1 ? 10: pageSize;
                pageSize = pageSize > 50 ? 50: pageSize;

                // Security Authentication 
                var loggedInUserId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (loggedInUserId != id.ToString())
                {
                    return Results.Forbid();
                }

                // Build the base query ( Dererred Excution )
                // find all Trasaction where this user send or recived money 
                var baseQuery = db.TransactionRecords
                .Where(t => t.FromAccountId == id || t.ToAccountId == id)
                .OrderByDescending(t => t.Timestamp); // newest receipts first 

                // 3. get the metadata how many total page exists 
                var totalRecord = await baseQuery.CountAsync();
                var totalPages = (int)Math.Ceiling(totalRecord /(double)pageSize );

                // 4. Fetch the specifc page (skip and take )
                var transactions = await baseQuery
                .Skip((page -1 ) * pageSize)
                .Take(pageSize)
                .Select(t => new
                {
                    TransactionId = t.Id,
                    Type = t.FromAccountId == id ? "DEBIT (send)" : "CREDIT (Received)",
                    CounterPartyAccount = t.FromAccountId == id ? t.ToAccountId : t.FromAccountId,
                    t.Amount,
                    t.Timestamp
                }).ToListAsync();

                // 5. Return the Evvelope 
                return Results.Ok (new 
                {
                    Metadata = new
                    {
                        CurrentPage = page,
                        PageSize = pageSize,
                        TotalRecord = totalRecord, 
                        TotalPages = totalPages
                    },
                    Data = transactions
                });
            }).RequireAuthorization();
    }
}