using MiniBankWallet.Data;
using MiniBankWallet.DTOs.Accounts;
using MiniBankWallet.Mappers;
using Microsoft.EntityFrameworkCore;
using MiniBankWallet.Services;
using MiniBankWallet.Helpers;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

using FluentValidation;
using MiniBankWallet.Models.Banking;
using MiniBankWallet.Models.Identity;
using MiniBankWallet.Models.Governance;
using Microsoft.Extensions.Caching.Memory;
using MiniBankWallet.Services.interfaces;
using MiniBankWallet.Filters;
namespace MiniBankWallet.Endpoints;

public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        // 1. THE ROOT GROUP
        // Everything starts with "/api/accounts" and gets this Swagger Tag.
        var baseGroup = app.MapGroup("/api/accounts").WithTags("Accounts & Customers");

        // ==============================================================
        // 2. PUBLIC ENDPOINTS (No Auth, No Antiforgery)
        // We attach this directly to the baseGroup because a new customer 
        // does not have a login session or a CSRF token yet.
        // ==============================================================
        baseGroup.MapPost("/", async Task<IResult>(
            CreateAccountRequest request,
            IValidator<CreateAccountRequest> Validator,
            IConfiguration config,
            AppDbContext db,
            IMemoryCache cache,
            INotificationService notificationService) =>
        {
            var validatorResult = await Validator.ValidateAsync(request);
            if (!validatorResult.IsValid) return Results.ValidationProblem(validatorResult.ToDictionary());

            cache.TryGetValue($"KYC_TOKEN_{request.MobileNumber}", out string? savedToken);
            if (string.IsNullOrEmpty(savedToken) || savedToken != request.KycToken)
                return Results.BadRequest("KYC Verification missing or expired. Please complete OTP verification again.");

            bool userExists = await db.Users.AnyAsync(u => u.AadharNumber == request.AadharNumber);
            if (userExists) return Results.Conflict("An Account with this Government ID already exists.");

            var newUser = new User
            {
                OwnerName = request.OwnerName.Trim(),
                AadharNumber = request.AadharNumber.Trim(),
                MobileNumber = request.MobileNumber.Trim(),
                Email = request.Email!.Trim(),
                Role = UserRole.Customer
            };

            decimal startingBalance = config.GetValue<decimal>("BankSettings:PromotionalStartingBalance");
            var newAccount = new BankAccount
            {
                AccountNumber = AccountGenratorService.Generate12DigitAccountNumber(),
                AccountType = Enum.Parse<AccountType>(request.AccountType, ignoreCase: true),
                Status = "Pending", 
                Balance = startingBalance,
                User = newUser
            };

            db.Users.Add(newUser);
            db.BankAccounts.Add(newAccount);
            await db.SaveChangesAsync();

            string mobileWithCountryCode = newUser.MobileNumber.StartsWith("+") ? newUser.MobileNumber : $"+91{newUser.MobileNumber}";
            string smsBody = $"Welcome to MiniBank, {newUser.OwnerName}! Your new {newAccount.AccountType} Account Number is {newAccount.AccountNumber}.";
            
            _ = notificationService.SendSmsAsync(mobileWithCountryCode, smsBody);

            var responseData = new AccountResponse(
                newAccount.AccountNumber, newUser.OwnerName, newUser.Email,
                newAccount.AccountType.ToString(), newAccount.Balance, newAccount.Status
            );
            
            cache.Remove($"KYC_TOKEN_{request.MobileNumber}");
            return Results.Created($"/api/accounts/{newAccount.AccountNumber}", responseData);
        })
        .WithSummary("Open a new Bank Account")
        .Produces<AccountResponse>(201)
        .ProducesValidationProblem(400);

        // ==============================================================
        // 3. SECURE WRITE ENDPOINTS (Requires Auth AND Antiforgery)
        // Any PUT, POST, PATCH, or DELETE must go in this sub-group!
        // ==============================================================
        var secureWriteGroup = baseGroup.MapGroup("")
            .RequireAuthorization("StaffOnly") ;

        // Update endpoinnt
        secureWriteGroup.MapPut("/users/{userId}/contact", async Task<IResult>(
            int userId,
            UpdateContactRequest request,
            AppDbContext db,
            ClaimsPrincipal loggedInUser) =>
        {
            var targetUser = await db.Users.FindAsync(userId);
            if (targetUser == null) return Results.NotFound("User not found.");

            // Get Staff details for Audit Log
            var staffIdStr = loggedInUser.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(staffIdStr, out int staffId);
            var staffRole = loggedInUser.FindFirst(ClaimTypes.Role)?.Value ?? "Unknown";

            // Track changes and build Audit Logs
            var auditLogs = new List<AuditLog>();

            if (!string.IsNullOrWhiteSpace(request.NewEmail) && request.NewEmail != targetUser.Email)
            {
                auditLogs.Add(new AuditLog
                {
                    PerformedByUserId = staffId,
                    PerformedByRole = staffRole,
                    TargetUserId = userId,
                    Action = "Updated Email",
                    OldValue = targetUser.Email,
                    NewValue = request.NewEmail
                });
                targetUser.Email = request.NewEmail;
            }

            if (!string.IsNullOrWhiteSpace(request.NewMobile) && request.NewMobile != targetUser.MobileNumber)
            {
                auditLogs.Add(new AuditLog
                {
                    PerformedByUserId = staffId,
                    PerformedByRole = staffRole,
                    TargetUserId = userId,
                    Action = "Updated Mobile",
                    OldValue = targetUser.MobileNumber,
                    NewValue = request.NewMobile
                });
                targetUser.MobileNumber = request.NewMobile;
            }

            if (auditLogs.Any())
            {
                db.AuditLogs.AddRange(auditLogs);
                await db.SaveChangesAsync();
                return Results.Ok(new { Message = "Contact details updated and audited successfully." });
            }

            return Results.BadRequest("No new details provided.");

        }).AddEndpointFilter<CsrfValidationFilter>();
        //===============================================================###################
        // #############################################=====================================

        var secureReadGroup = baseGroup.MapGroup("")
            .RequireAuthorization();
        // FETCH MY ACCOUNTS (For the React Dashboard)
        // ==========================================
        secureReadGroup.MapGet("/me", async Task<IResult>(AppDbContext db, ClaimsPrincipal user) =>
        {
            // Extract the UserId directly from the JWT token
            var loggedInUserIdStr = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(loggedInUserIdStr, out int userId)) return Results.Unauthorized();

            var myAccounts = await db.BankAccounts
                .Where(a => a.UserId == userId)
                .Select(a => new
                {
                    a.AccountNumber,
                    a.AccountType,
                    a.Balance,
                    a.Status
                })
                .ToListAsync();

            return Results.Ok(myAccounts);
        });

        // GET specific account 
        secureReadGroup.MapGet("/{identifier}", async Task<IResult>(
            string identifier,
            AppDbContext db,
            ClaimsPrincipal loggedInUser) => // fixed spelling here
        {
            var searchValue = identifier.Trim();

            var user = await db.Users.FirstOrDefaultAsync(u =>
            u.MobileNumber == searchValue ||
            u.Email == identifier);

            string? matchedAccountNumber = null;

            if (user == null)
            {
                // FIX: Added .Include(a => a.User)
                var account = await db.BankAccounts
                    .Include(a => a.User)
                    .FirstOrDefaultAsync(a => a.AccountNumber == searchValue);

                if (account != null)
                {
                    user = account.User;
                    matchedAccountNumber = account.AccountNumber;
                }
            }

            if (user == null) return Results.NotFound("User or Account not found");

            // RBAC UPGRADE: Staff Bypass!
            var (loggedInUserId, isStaff) = SecurityContext.GetSecurityContext(loggedInUser);

            // If you are NOT staff, and this is NOT your account, get out!
            if (!isStaff && loggedInUserId != user.Id) return Results.Forbid();

            var accounts = await db.BankAccounts
                .Where(a => a.UserId == user.Id)
                .OrderBy(a => a.AccountNumber)
                .Select(a => new AccountLookupAccount(
                a.AccountNumber,
                a.AccountType.ToString(),
                a.Status,
                a.Balance
                ))
                .ToListAsync();

            var response = new AccountLookupResponse(
                UserId: user.Id,
                OwnerName: user.OwnerName,
                Email: user.Email,
                MobileNumber: user.MobileNumber,
                MatchedAccountNumber: matchedAccountNumber,
                Accounts: accounts
            );
                

            return Results.Ok(response);
        });

        // ##############################################################
        // Check balance 
        secureReadGroup.MapGet("/{accountNumber}/balance", async Task <IResult>(
            string accountNumber,
            AppDbContext db,
            ClaimsPrincipal user) =>
        {
            var account = await db.BankAccounts.FirstOrDefaultAsync(a => a.AccountNumber == accountNumber);
            if (account is null) return Results.NotFound("Invalid accountNumber");

            // RBAC UPGRADE & IDENTITY FIX
            var loggedInUserId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            bool isStaff = user.IsInRole("Admin") || user.IsInRole("Teller");

            // FIX: Checking against account.UserId, not account.Id
            if (!isStaff && loggedInUserId != account.UserId.ToString()) return Results.Forbid();

            return Results.Ok(new { AccountNumber = account.AccountNumber, Balance = account.Balance });
        }); 

        // ===================================================########################
        // Pagination Trasaction history 
        // GET/api/accounts/{accountNumber} Trasactions?page=1&pageSize=10
        secureReadGroup.MapGet("/{accountNumber}/transactions", async Task<IResult> (
            string accountNumber,
            [FromQuery] int? page,
            [FromQuery] int? pageSize,
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate,
            AppDbContext db,
            ClaimsPrincipal user) =>
            {
                //1.  set default if user forget to send them 
                int currentPage = Math.Max(1, page ?? 1);
                int currentSize = Math.Max(1, pageSize ?? 10);
                currentSize = Math.Min(50, currentSize);

                var account = await db.BankAccounts.FirstOrDefaultAsync(a => a.AccountNumber == accountNumber);
                if (account is null) return Results.NotFound("Account Not Found ");

                //2.  Security Authentication 
                // RBAC UPGRADE & IDENTITY FIX
                var (loggedInUserId, isStaff) = SecurityContext.GetSecurityContext(user);

                if (!isStaff && loggedInUserId != account.UserId) return Results.Forbid();
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
            });

    }
}