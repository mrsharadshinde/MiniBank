using MiniBankWallet.Data;
using MiniBankWallet.Models;
using MiniBankWallet.DTOs.Accounts;
using MiniBankWallet.Mappers;
using Microsoft.EntityFrameworkCore;
using MiniBankWallet.Services;

using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

using FluentValidation;
using MiniBankWallet.Models.Banking;
using MiniBankWallet.Models.Identity;

namespace MiniBankWallet.Endpoints;

public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        // creat the root group 
        var group = app.MapGroup("/api/accounts");

        // =============================================
        // create the accound ( Open new Bank account)
        group.MapPost("/", async (
            CreateAccountRequest request,
            IValidator<CreateAccountRequest> Validator,
            AppDbContext db) =>
        {
            //1. basic validaiton 
            var validatorResult = await Validator.ValidateAsync(request);

            if (!validatorResult.IsValid)
            {
                return Results.ValidationProblem(validatorResult.ToDictionary());
            }
            //2. check if user exists
            bool userExists = await db.Users.AnyAsync(u => u.AadharNumber == request.AadharNumber);
            if (userExists) return Results.Conflict("An Account with this AadharNumber already exists.");

            // 3. Create new user PROFILE
            var newUser = new User
            {
                OwnerName = request.OwnerName,
                AadharNumber = request.AadharNumber,
                MobileNumber = request.MobileNumber,
                Email = request.Email!,
                Role = UserRole.Customer
            };

            // 4. Create the Financial Profile
            var newAccount = new BankAccount
            {
                AccountNumber = AccountGenratorService.Generate12DigitAccountNumber(),
                AccountType = Enum.Parse<AccountType>(request.AccountType, ignoreCase: true),
                Status = "Active", // Requires Admin/ KYC approval later 
                Balance = 1000,
                User = newUser
            };

            // 5. Save both to the database
            db.Users.Add(newUser);
            db.BankAccounts.Add(newAccount);
            await db.SaveChangesAsync();

            var responseData = new AccountResponse(
                newAccount.AccountNumber,
                newUser.OwnerName,
                newUser.Email,
                newAccount.AccountType.ToString(),
                newAccount.Balance,
                newAccount.Status
            );
            return Results.Created($"/api/accounts/{newAccount.AccountNumber}", responseData);
        });


        //===============================================================

        // get specific account 
        group.MapGet("/{identifier}", async (
            string identifier,
            AppDbContext db,
            ClaimsPrincipal logedInuser) =>
        {
            // find the the user with Mobile number or email 
            var user = await db.Users
                .FirstOrDefaultAsync(u => u.MobileNumber == identifier || u.Email == identifier);

            //  if not found with email or MobileNumber find the account with accountNumber
            if (user == null)
            {
                var account = await db.BankAccounts
                    .FirstOrDefaultAsync(a => a.AccountNumber == identifier);

                if (account != null)
                {
                    user = account.User;
                }
            }
            // if still user not found 
            if (user == null)
            {
                return Results.BadRequest("Invalid SigningCredentials");
            }

            // logged in user 
            var loggedInUserId = logedInuser.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (loggedInUserId != user.Id.ToString()) return Results.Forbid();

            var UpdatedUser = new {
                user.OwnerName,
                user.Email
            };

            return Results.Ok(UpdatedUser);
        }).RequireAuthorization();

        // Check balance 
        group.MapGet("/{accountNumber}/balance", async (
            string accountNumber,
            AppDbContext db,
            ClaimsPrincipal user) =>
        {
            var account = await db.BankAccounts
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

                var account = await db.BankAccounts.FirstOrDefaultAsync(a => a.AccountNumber == accountNumber);
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