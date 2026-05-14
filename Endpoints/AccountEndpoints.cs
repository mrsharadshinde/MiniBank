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
            };

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

            if (account is null) return Results.NotFound();

            // Security : ensure the authorization 
            var loggedInUserId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (loggedInUserId != account.Id.ToString()) return Results.Forbid();

            // Update allwoed firlds 
            account.Email = request.Email;
            await db.SaveChangesAsync();

            return Results.Ok(new { message = "Account updated Successfully. ", });
        }).RequireAuthorization();

        // ==================================================================

        // get specific account 
        group.MapGet("/{accountNumber}", async (
            string accountNumber,
            AppDbContext db,
            ClaimsPrincipal user) =>
        {
            var account = await db.Accounts
                .FirstOrDefaultAsync(a => a.AccountNumber == accountNumber);
            if (account is null) return Results.NotFound("Invalid accountNumber");

            // logges in user 
            var loggedInUserId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (loggedInUserId != account.Id.ToString()) return Results.Forbid();

            return Results.Ok(account.ToAccountResponse());
        }).RequireAuthorization();

        // Check balance 
        group.MapGet("/{accountNumber}/balance", async (
            string accountNumber,
            AppDbContext db,
            ClaimsPrincipal user) =>
        {
            var account = await db.Accounts
                .FirstOrDefaultAsync(a => a.AccountNumber == accountNumber);

            if (account is null) return Results.NotFound("Invalid accountNumber");

            var loggedInUserId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (loggedInUserId != account.Id.ToString()) return Results.Forbid();

            return Results.Ok(new { AccountNummber = account.AccountNumber, Balance = account.Balance });
        });

        // ===================================================
        // Pagination Trasaction history 
        // GET/api/accounts/{accountNumber} Trasactions?page=1&pageSize=10
        group.MapGet("/{accountNumber}/trasactions", async (
            string accountNumber,
            [FromQuery] int? page,
            [FromQuery] int? pageSize,
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate,
            AppDbContext db,
            ClaimsPrincipal user) =>
            {
                //1.  set default if user forget to send them 
                int currentPage = (page ?? 1) < 1 ? 1 : page.Value;
                int currentSize = (pageSize ?? 10) < 1 ? 10 : pageSize.Value;
                currentSize = currentSize > 50 ? 50 : currentSize;

                var account = await db.Accounts.FirstOrDefaultAsync(a => a.AccountNumber == accountNumber);
                if (account is null) return Results.NotFound("Account Not Found ");

                //2.  Security Authentication 
                var loggedInUserId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (loggedInUserId != account.Id.ToString()) return Results.Forbid();


                //3.  Build the base query ( Dererred Excution )
                var baseQuery = db.LedgerEntries.Where(l => l.AccountId == account.Id).AsQueryable();

                if (startDate.HasValue)
                    baseQuery = baseQuery.Where(l => l.CreatedAt >= startDate.Value);

                if (endDate.HasValue)
                    baseQuery = baseQuery.Where(l => l.CreatedAt <= endDate.Value);

                baseQuery = baseQuery.OrderByDescending(l => l.CreatedAt);

                // 4. get the metadata how many total page exists 
                var totalRecords = await baseQuery.CountAsync();
                var totalPages = (int)Math.Ceiling(totalRecords / (double)currentSize);

                // 5. Fetch and Map to our strict DTO 
                var transactions = await baseQuery
                .Skip((currentPage - 1) * currentSize)
                .Take(currentSize)
                .MapToStatementDTO()
                .ToListAsync();

                var response = new StatementResponse(
                    transactions,
                    new PaginationMetadata(currentPage, currentSize, totalRecords, totalPages)
                );

                return Results.Ok(response);
            }).RequireAuthorization();
    }
}