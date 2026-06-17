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
        // 1. Group all admin routes together and protect them
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

            // Check if this contact info already belongs to an existing staff member
            bool staffExists = await db.Users.AnyAsync(u =>
                (u.MobileNumber == request.MobileNumber || u.Email == request.Email) &&
                (u.Role == UserRole.Admin || u.Role == UserRole.Teller));

            if (staffExists)
                return Results.Conflict("A staff member with this mobile number or email already exists.");

            // Generate secure 6-digit OTPs
            string mobileOtp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            string emailOtp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

            // Set expiration (10 minutes)
            var cacheOptions = new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(TimeSpan.FromMinutes(10));

            // Save to cache
            string mobileKey = $"STAFF_OTP_MOBILE_{request.MobileNumber}";
            string emailKey = $"STAFF_OTP_EMAIL_{request.Email}";
            cache.Set(mobileKey, mobileOtp, cacheOptions);
            cache.Set(emailKey, emailOtp, cacheOptions);

            // Send OTPs via notification service
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

            // Retrieve saved OTPs from cache
            string mobileKey = $"STAFF_OTP_MOBILE_{request.MobileNumber}";
            string emailKey = $"STAFF_OTP_EMAIL_{request.Email}";

            cache.TryGetValue(mobileKey, out string? savedMobileOtp);
            cache.TryGetValue(emailKey, out string? savedEmailOtp);

            // Validate OTPs exist
            if (savedMobileOtp == null || savedEmailOtp == null)
                return Results.BadRequest("OTPs have expired or were never requested.");

            // Validate OTP values
            if (savedMobileOtp != request.MobileOtp || savedEmailOtp != request.EmailOtp)
                return Results.BadRequest("Invalid verification codes.");

            // Clean up OTPs (one-time use)
            cache.Remove(mobileKey);
            cache.Remove(emailKey);

            // Generate staff provisioning token (valid for 30 minutes)
            string staffProvisioningToken = Guid.NewGuid().ToString();
            string tokenKey = $"STAFF_PROVISIONING_TOKEN_{request.Email}_{request.MobileNumber}";
            cache.Set(tokenKey, staffProvisioningToken, TimeSpan.FromMinutes(30));

            return Results.Ok(new
            {
                Message = "Contact verified successfully.",
                StaffProvisioningToken = staffProvisioningToken
            });
        });

        // 2. The Provision Staff Endpoint
        adminGroup.MapPost("/provision-staff", async (
            ProvisionStaffRequest request,
            AppDbContext db,
            INotificationService notificationService,
            IMemoryCache cache,
            ClaimsPrincipal adminUser) =>
        {
            var adminId = int.Parse(adminUser.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            // Verify the staff provisioning token
            string tokenKey = $"STAFF_PROVISIONING_TOKEN_{request.Email}_{request.MobileNumber}";
            cache.TryGetValue(tokenKey, out string? savedToken);

            if (string.IsNullOrWhiteSpace(savedToken) || savedToken != request.StaffProvisioningToken)
                return Results.Json(
         data: new { Message = "Invalid or expired provisioning token. Please complete OTP verification first." },
         statusCode: StatusCodes.Status401Unauthorized
     );
            // Check if email already exists
            if (await db.Users.AnyAsync(u => u.Email == request.Email))
                return Results.BadRequest("User with this email already exists.");

            // Check if mobile number already exists
            if (await db.Users.AnyAsync(u => u.MobileNumber == request.MobileNumber))
                return Results.BadRequest("User with this mobile number already exists.");

            // Check if Aadhar number already exists
            if (await db.Users.AnyAsync(u => u.AadharNumber == request.AadharNumber))
                return Results.BadRequest("User with this Aadhar number already exists.");

            // Generate secure temp password
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

            // Clean up the token after use
            cache.Remove(tokenKey);

            // Send Credentials via Email
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

        // ==========================================
        // 🔥 NEW: GET PENDING ACCOUNTS
        // ==========================================
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

        // ==========================================
        // 🔥 NEW: ACTIVATE / SUSPEND / REJECT ACCOUNT
        // ==========================================
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

            // 🔥 1. Track the old status for the Audit Log
            string oldStatus = account.Status;

            // 🔥 2. Apply the updates
            account.Status = request.NewStatus;
            account.UpdatedAt = DateTime.UtcNow; // Keep timestamps accurate
            account.Version = Guid.NewGuid();    // Bump concurrency token

            // 🔥 3. Save to Audit Log
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