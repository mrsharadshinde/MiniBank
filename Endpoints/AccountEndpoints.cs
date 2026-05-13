using MiniBankWallet.Data;
using MiniBankWallet.Models;
using MiniBankWallet.DTOs.Accounts;
using MiniBankWallet.Mappers;
using Microsoft.EntityFrameworkCore;
using MiniBankWallet.Services;

using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

using FluentValidation;
using System.ComponentModel.DataAnnotations;

namespace MiniBankWallet.Endpoints;

public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        // creat the root group 
        var group = app.MapGroup("/api/accounts");

        // getting account types for frontend dropdown 
        group.MapGet("/types", () =>
        {
            var types = Enum.GetNames(typeof(AccountType));
            return Results.Ok(types);
        });
        // =============================================
        // create the accound ( Open new Bank account)
        group.MapPost("/", async (
            CreateAccountRequest request,
            IValidator<CreateAccountRequest> Validator,
            AppDbContext db) =>
        {
            // basic validaiton 
            var validatorResult = await Validator.ValidateAsync(request);

            if (!validatorResult.IsValid)
            {
                return Results.ValidationProblem(validatorResult.ToDictionary());
            }
            // Ensure Mobile number isn't already registred 
            bool phoneExists = await db.Accounts.AnyAsync(a => a.MobileNumber == request.MobileNumber);
            if (phoneExists) return Results.Conflict("An Account with this Mobile number already exists.");

            var newAccount = new Account
            {
                AccountNumber = AccountGenratorService.Generate12DigitAccountNumber(),
                OwnerName = request.OwnerName,
                MobileNumber = request.MobileNumber,
                Email = request.Email,
                AccountType = Enum.Parse<AccountType>(request.AccountType, ignoreCase: true),
                Status = "Active", // Requires Admin/ KYC approval later 
                Balance = 1000,
                Version = Guid.NewGuid()
            } ;

            db.Accounts.Add(newAccount);
            await db.SaveChangesAsync();

            return Results.Created($"/api/accounts/{newAccount.AccountNumber}", newAccount.ToAccountResponse());
        });

        
        //================================================================
        // 2. Update Account Details 
        group.MapPut("/{accountNumber}", async (
            string accountNumber,
            UpdateAccountRequest request, 
            AppDbContext db,
            ClaimsPrincipal user) =>
        {
            var account = await db.Accounts.FirstOrDefaultAsync(a => a.AccountNumber == accountNumber);

            if (account is null ) return Results.NotFound();

            // Security : ensure the authorization 
            var loggedInUserId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if(loggedInUserId != account.Id.ToString()) return Results.Forbid();

            // Update allwoed firlds 
            account.Email = request.Email;
            await db.SaveChangesAsync();

            return Results.Ok(new {message = "Account updated Successfully. ", });
        }).RequireAuthorization();
        // ==================================================================
        
        // get specific account 
        group.MapGet("/{accountNumber}", async (
            string accountNumber,
            AppDbContext db,
            ClaimsPrincipal user )=>
        {
                var account  = await db.Accounts
                    .FirstOrDefaultAsync(a => a.AccountNumber == accountNumber);
                if (account is null ) return Results.NotFound("Invalid accountNumber");

                // logges in user 
                var loggedInUserId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (loggedInUserId != account.Id.ToString()) return Results.Forbid(); 
                
                return Results.Ok(account.ToAccountResponse());
        }).RequireAuthorization();

        // Check balance 
        group.MapGet("/{accountNumber}/balance", async (
            string accountNumber,
            AppDbContext db,
            ClaimsPrincipal user ) =>
        {
            var account = await db.Accounts
                .FirstOrDefaultAsync(a => a.AccountNumber == accountNumber);
            
            if (account is null ) return Results.NotFound("Invalid accountNumber");

            var loggedInUserId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (loggedInUserId != account.Id.ToString()) return Results.Forbid();
            
            return Results.Ok(new { AccountNummber = account.AccountNumber, Balance = account.Balance});
        });

        // ===================================================
        // Pagination Trasaction history 
        // GET/api/accounts/{accountNumber} Trasactions?page=1&pageSize=10
        group.MapGet("/{accountNumber}/trasactions", async (
            string accountNumber,
            [FromQuery] int page,
            [FromQuery] int pageSize, 
            AppDbContext db,
            ClaimsPrincipal user) =>
            {
                // set default if user forget to send them 
                page = page < 1 ? 1: page;
                pageSize = pageSize < 1 ? 10: pageSize;
                pageSize = pageSize > 50 ? 50: pageSize;

                var account = await db.Accounts.FirstOrDefaultAsync(a => a.AccountNumber == accountNumber);
                if (account is null) return Results.NotFound("Account Not Found ");

                // Security Authentication 
                var loggedInUserId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (loggedInUserId != account.Id.ToString()) return Results.Forbid();
                

                // Build the base query ( Dererred Excution )
                // find all Trasaction where this user send or recived money 
                int internalId = account.Id;
                var baseQuery = db.TransactionRecords
                .Where(t => t.FromAccountId == internalId || t.ToAccountId == internalId)
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
                    Type = t.FromAccountId == internalId ? "DEBIT (send)" : "CREDIT (Received)",
                    CounterPartyAccount = t.FromAccountId == internalId ? t.ToAccountId : t.FromAccountId,
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