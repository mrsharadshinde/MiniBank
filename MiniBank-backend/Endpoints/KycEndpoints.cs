using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using MiniBankWallet.Data;
using MiniBankWallet.DTOs.Accounts;
using MiniBankWallet.Services.interfaces;
using System.Security.Cryptography;

namespace MiniBankWallet.Endpoints;

public static class KycEndpoints
{
    public static void MapKycEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/kyc").WithTags("KYC Pre-Verification");

        // 1. SEND OTP
        // 1. SEND OTP
        group.MapPost("/send-otp", async (
            KycSendOtpRequest request,
            IMemoryCache cache,
            INotificationService notificationService,
            AppDbContext db) => // <-- INJECT AppDbContext HERE!
        {
            if (string.IsNullOrWhiteSpace(request.MobileNumber) || string.IsNullOrWhiteSpace(request.Email))
            {
                return Results.BadRequest("Mobile number and email are required.");
            }

            // --- THE NEW SECURITY CHECK ---
            // Check if this contact info already belongs to someone in the database
            bool userExists = await db.Users.AnyAsync(u =>
                u.MobileNumber == request.MobileNumber ||
                u.Email == request.Email);

            if (userExists)
            {
                return Results.Conflict("A customer with this mobile number or email already exists. Please use the Customer Lookup tab.");
            }
            // ------------------------------

            // 1. Generate Secure 6-digit codes
            string mobileOtp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            string emailOtp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

            // ... (The rest of your existing OTP generation and Cache saving code remains exactly the same) ...
            // 2. Set the expiration rules (Destroyed after 10 minutes)
            var cacheOptions = new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(TimeSpan.FromMinutes(10));

            // 3. Save to RAM using the Phone/Email as the unique keys
            cache.Set($"OTP_MOBILE_{request.MobileNumber}", mobileOtp, cacheOptions);
            cache.Set($"OTP_EMAIL_{request.Email}", emailOtp, cacheOptions);

            string mobileWithCountryCode = request.MobileNumber.StartsWith("+")
                ? request.MobileNumber
                : $"+91{request.MobileNumber}";

            string smsMessage = $"Your MiniBank KYC mobile verification code is: {mobileOtp}. Do not share this code with anyone.";
            string emailSubject = "MiniBank KYC Verification Code";
            string emailBody = $"Your MiniBank KYC email verification code is: {emailOtp}. Do not share this code with anyone.";
            Console.WriteLine(smsMessage);
            Console.WriteLine(emailBody);
            await notificationService.SendSmsAsync(mobileWithCountryCode, smsMessage);
            await notificationService.SendEmailAsync(request.Email, emailSubject, emailBody);

            return Results.Ok(new { Message = "Verification codes sent successfully." });
        });


        // 2. VERIFY OTP
        group.MapPost("/verify-otp", (KycVerifyOtpRequest request, IMemoryCache cache) =>
        {
            if (string.IsNullOrWhiteSpace(request.MobileNumber) || string.IsNullOrWhiteSpace(request.Email))
            {
                return Results.BadRequest("Mobile number and email are required.");
            }

            // 1. Try to pull the saved codes out of RAM
            cache.TryGetValue($"OTP_MOBILE_{request.MobileNumber}", out string? savedMobileOtp);
            cache.TryGetValue($"OTP_EMAIL_{request.Email}", out string? savedEmailOtp);

            // 2. Validate
            if (savedMobileOtp == null || savedEmailOtp == null)
            {
                return Results.BadRequest("OTPs have expired or were never requested.");
            }

            if (savedMobileOtp != request.MobileOtp || savedEmailOtp != request.EmailOtp)
            {
                return Results.BadRequest("Invalid verification codes.");
            }

            // 3. Clean up the RAM (OTPs are one-time use!)
            cache.Remove($"OTP_MOBILE_{request.MobileNumber}");
            cache.Remove($"OTP_EMAIL_{request.Email}");

            // 4. Issue a "KYC Token" (A temporary pass proving they passed OTP)
            string kycToken = Guid.NewGuid().ToString();

            // Save this token to RAM for 30 minutes. 
            // When the Teller clicks "Create Account", they will pass this token to prove they did the OTP step!
            cache.Set($"KYC_TOKEN_{request.MobileNumber}", kycToken, TimeSpan.FromMinutes(30));

            return Results.Ok(new
            {
                Message = "Contact verified successfully.",
                KycToken = kycToken
            });
        });
    }
}