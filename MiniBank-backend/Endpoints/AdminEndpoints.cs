using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using MiniBankWallet.Helpers;
using MiniBankWallet.Data;
using MiniBankWallet.Models.Identity;
using MiniBankWallet.Services.interfaces;
using System.Security.Claims;
using System.Security.Cryptography;
using MiniBankWallet.DTOs.PayLoads;
using MiniBankWallet.Models.Governance;

namespace MiniBankWallet.Endpoints;

public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var adminGroup = app.MapGroup("/api/admin").RequireAuthorization("AdminOnly").WithTags("Admin Activity");

        // ==========================================
        // STAFF PROVISIONING OTP FLOW
        // ==========================================
        adminGroup.MapPost("/staff/send-otp", async (
            StaffProvisioningSendOtpRequest request,
            IMemoryCache cache,
            INotificationService notificationService,
            AppDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(request.MobileNumber) || string.IsNullOrWhiteSpace(request.Email))
                return Results.BadRequest("Mobile number and email are required.");

            // 🔥 UPDATED: Strict global check to prevent sending OTPs if the email or mobile is already in the database
            bool userExists = await db.Users.AnyAsync(u =>
                u.MobileNumber == request.MobileNumber || u.Email == request.Email);

            if (userExists)
                return Results.Conflict("A user with this mobile number or email is already registered in the system.");

            string mobileOtp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            string emailOtp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

            var cacheOptions = new MemoryCacheEntryOptions().SetAbsoluteExpiration(TimeSpan.FromMinutes(10));

            string mobileKey = $"STAFF_OTP_MOBILE_{request.MobileNumber}";
            string emailKey = $"STAFF_OTP_EMAIL_{request.Email}";
            cache.Set(mobileKey, mobileOtp, cacheOptions);
            cache.Set(emailKey, emailOtp, cacheOptions);

            string mobileWithCountryCode = request.MobileNumber.StartsWith("+")
                ? request.MobileNumber
                : $"+91{request.MobileNumber}";

            string smsMessage = $"Your MiniBank staff provisioning verification code is: {mobileOtp}. Do not share this code with anyone.";
            string emailSubject = "MiniBank Staff Provisioning - Verification Code";
            string emailBody = $@"
                <p>Your MiniBank staff provisioning verification code is: <b>{emailOtp}</b></p>
                <p>This code will expire in 10 minutes.</p>
                <p>Do not share this code with anyone.</p>
            ";

            Console.WriteLine($"[SMS] {smsMessage}");
            Console.WriteLine($"[EMAIL] {emailBody}");

            await notificationService.SendSmsAsync(mobileWithCountryCode, smsMessage);
            await notificationService.SendEmailAsync(request.Email, emailSubject, emailBody);

            return Results.Ok(new { Message = "Verification codes sent to email and mobile." });
        });

        adminGroup.MapPost("/staff/verify-otp", async (
            StaffProvisioningVerifyOtpRequest request,
            IMemoryCache cache,
            AppDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(request.MobileNumber) || string.IsNullOrWhiteSpace(request.Email))
                return Results.BadRequest("Mobile number and email are required.");

            string mobileKey = $"STAFF_OTP_MOBILE_{request.MobileNumber}";
            string emailKey = $"STAFF_OTP_EMAIL_{request.Email}";

            cache.TryGetValue(mobileKey, out string? savedMobileOtp);
            cache.TryGetValue(emailKey, out string? savedEmailOtp);

            if (savedMobileOtp == null || savedEmailOtp == null)
                return Results.BadRequest("OTPs have expired or were never requested.");

            if (savedMobileOtp != request.MobileOtp || savedEmailOtp != request.EmailOtp)
                return Results.BadRequest("Invalid verification codes.");

            cache.Remove(mobileKey);
            cache.Remove(emailKey);

            string staffProvisioningToken = Guid.NewGuid().ToString();
            string tokenKey = $"STAFF_PROVISIONING_TOKEN_{request.Email}_{request.MobileNumber}";
            cache.Set(tokenKey, staffProvisioningToken, TimeSpan.FromMinutes(30));

            return Results.Ok(new
            {
                Message = "Contact verified successfully.",
                StaffProvisioningToken = staffProvisioningToken
            });
        });

        adminGroup.MapPost("/provision-staff", async (
            ProvisionStaffRequest request,
            AppDbContext db,
            INotificationService notificationService,
            IMemoryCache cache,
            ClaimsPrincipal adminUser) =>
        {
            var adminId = int.Parse(adminUser.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            string tokenKey = $"STAFF_PROVISIONING_TOKEN_{request.Email}_{request.MobileNumber}";
            cache.TryGetValue(tokenKey, out string? savedToken);

            if (string.IsNullOrWhiteSpace(savedToken) || savedToken != request.StaffProvisioningToken)
                return Results.Json(
                    data: new { Message = "Invalid or expired provisioning token. Please complete OTP verification first." },
                    statusCode: StatusCodes.Status401Unauthorized
                );

            if (await db.Users.AnyAsync(u => u.Email == request.Email))
                return Results.BadRequest("User with this email already exists.");

            if (await db.Users.AnyAsync(u => u.MobileNumber == request.MobileNumber))
                return Results.BadRequest("User with this mobile number already exists.");

            if (await db.Users.AnyAsync(u => u.AadharNumber == request.AadharNumber))
                return Results.BadRequest("User with this Aadhar number already exists.");

            string tempPassword = SecurityHelper.GenerateRandomPassword(12);
            string hashedPassword = BCrypt.Net.BCrypt.HashPassword(tempPassword);

            var newTeller = new User
            {
                OwnerName = request.FullName,
                Email = request.Email,
                MobileNumber = request.MobileNumber,
                AadharNumber = request.AadharNumber,
                Role = UserRole.Teller,
                PasswordHash = hashedPassword,
                RequiresPasswordReset = true,
                CreatedAt = DateTime.UtcNow,
                CreatedByAdminId = adminId
            };

            db.Users.Add(newTeller);
            await db.SaveChangesAsync();

            cache.Remove(tokenKey);

            string emailBody = $@"
                <h3>Welcome to MiniBank, {newTeller.OwnerName}!</h3>
                <p>Your Teller account has been successfully provisioned by the Admin team.</p>
                <p>Your Employee ID is: <b>{newTeller.Id}</b></p>
                <p>Your Temporary Password is: <b>{tempPassword}</b></p>
                <p><i>You will be required to change this password upon your first login.</i></p>
            ";

            await notificationService.SendEmailAsync(newTeller.Email, "Your MiniBank Teller Credentials", emailBody);

            return Results.Ok(new { Message = "Teller provisioned successfully.", Email = newTeller.Email });
        });

        adminGroup.MapGet("/accounts/pending", async (AppDbContext db) =>
        {
            var pendingAccounts = await db.BankAccounts
                .Where(a => a.Status == "Pending")
                .Select(a => new
                {
                    a.AccountNumber,
                    a.AccountType,
                    a.CreatedAt,
                    OwnerName = a.User.OwnerName,
                    Email = a.User.Email
                })
                .ToListAsync();

            return Results.Ok(pendingAccounts);
        });

        adminGroup.MapPut("/accounts/{accountNumber}/status", async (
            string accountNumber,
            UpdateAccountStatusRequest request,
            AppDbContext db,
            ClaimsPrincipal loggedInUser) =>
        {
            var validStatuses = new[] { "Active", "Suspended", "Rejected", "Closed" };
            if (!validStatuses.Contains(request.NewStatus))
                return Results.BadRequest("Invalid status. Allowed values: Active, Suspended, Rejected, Closed.");

            var account = await db.BankAccounts.FirstOrDefaultAsync(a => a.AccountNumber == accountNumber);
            if (account == null)
                return Results.NotFound("Account not found.");

            if (account.Status == request.NewStatus)
                return Results.BadRequest($"Account is already {account.Status}.");

            string oldStatus = account.Status;

            account.Status = request.NewStatus;
            account.UpdatedAt = DateTime.UtcNow; 
            account.Version = Guid.NewGuid();    

            var adminIdStr = loggedInUser.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(adminIdStr, out int adminId);

            var auditLog = new AuditLog
            {
                PerformedByUserId = adminId,
                PerformedByRole = "Admin",
                TargetUserId = account.UserId,
                Action = "Updated Account Status",
                OldValue = oldStatus,
                NewValue = request.NewStatus + (string.IsNullOrWhiteSpace(request.Remarks) ? "" : $" | Reason: {request.Remarks}")
            };
            db.AuditLogs.Add(auditLog);

            await db.SaveChangesAsync();

            return Results.Ok(new
            {
                Message = $"Account {accountNumber} status successfully updated to {request.NewStatus}.",
                AccountNumber = account.AccountNumber,
                Status = account.Status
            });
        });
    }
}