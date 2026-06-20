using System.Security.Claims;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using MiniBankWallet.Data;
using MiniBankWallet.Helpers;
using MiniBankWallet.Models.Identity;
using MiniBankWallet.Services;
using MiniBankWallet.Services.interfaces;

namespace MiniBankWallet.Endpoints;

// ==========================================
// DTOs
// ==========================================
public record OtpRequest(string LoginId);
public record VerifyOtpRequest(string LoginId, string Otp);
public record StaffLoginRequest(string Email, string Password);
public record ChangePasswordRequest(string Email, string OldTempPassword, string NewPassword);
public record TokenRefreshRequest(string AccessToken, string RefreshToken);

// ==========================================
// AUTH ENDPOINTS
// ==========================================
public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app, IConfiguration config)
    {
        var group = app.MapGroup("/api/auth").WithTags("Authentication");

        // ----------------------------------------------------------------------------------
        // 1. REQUEST OTP (Customer Flow)
        // ----------------------------------------------------------------------------------
        group.MapPost("/request-otp", async (
            OtpRequest request,
            AppDbContext db,
            IMemoryCache cache,
            IBackgroundJobClient backgroundJobs) =>
        {
            if (string.IsNullOrWhiteSpace(request?.LoginId))
                return Results.BadRequest("LoginId cannot be empty. Please provide an Email, Mobile, or Account Number.");

            string loginId = request.LoginId.Trim();

            var requestingUser = await db.Users.FirstOrDefaultAsync(u =>
                u.MobileNumber == loginId || u.Email == loginId || u.AadharNumber == loginId);

            if (requestingUser == null)
            {
                var account = await db.BankAccounts
                    .Include(b => b.User)
                    .FirstOrDefaultAsync(b => b.AccountNumber == loginId);

                if (account != null) requestingUser = account.User;
            }

            if (requestingUser == null)
                return Results.BadRequest("Account not found");

            var otp = new Random().Next(100000, 999999).ToString();
            cache.Set(loginId, otp, TimeSpan.FromMinutes(3));

            string message = $"Your MiniBank verification code is: {otp}. Do not share this with anyone";
            Console.WriteLine(message); // For local testing

            if (loginId.Contains('@'))
            {
                backgroundJobs.Enqueue<INotificationService>(
                    notificationService => notificationService.SendEmailAsync(requestingUser.Email, "MiniBank OTP", message)
                );
            }
            else
            {
                if (string.IsNullOrWhiteSpace(requestingUser.MobileNumber))
                    return Results.BadRequest("No mobile number registered to this account.");

                string mobileWithCountryCode = requestingUser.MobileNumber.StartsWith("+")
                    ? requestingUser.MobileNumber
                    : $"+91{requestingUser.MobileNumber}";

                backgroundJobs.Enqueue<INotificationService>(
                    notificationService => notificationService.SendSmsAsync(mobileWithCountryCode, message)
                );
            }

            return Results.Ok(new { Message = "OTP sent Successfully." });
        }).RequireRateLimiting("OtpRateLimit");

        // ----------------------------------------------------------------------------------
        // 2. VERIFY OTP (Customer Flow)
        // ----------------------------------------------------------------------------------
        // 🔥 FIX 1: Inject HttpContext and IAntiforgery
        group.MapPost("/verify-otp", async (
            VerifyOtpRequest request,
            AppDbContext db,
            IMemoryCache cache,
            HttpContext httpContext, 
            Microsoft.AspNetCore.Antiforgery.IAntiforgery antiforgery) =>
        {
            if (!cache.TryGetValue(request.LoginId, out string? savedOtp))
                return Results.BadRequest("OTP expired or not requested.");

            if (savedOtp != request.Otp.Trim())
                return Results.Unauthorized();

            cache.Remove(request.LoginId);

            User? loggingInUser = await db.Users.FirstOrDefaultAsync(u =>
                u.Email == request.LoginId || u.MobileNumber == request.LoginId || u.AadharNumber == request.LoginId);

            if (loggingInUser == null)
            {
                var account = await db.BankAccounts
                    .Include(b => b.User)
                    .FirstOrDefaultAsync(b => b.AccountNumber == request.LoginId);

                if (account != null) loggingInUser = account.User;
            }

            if (loggingInUser == null)
                return Results.BadRequest("Invalid Login ID. User not found.");

            // Generate JWT and Refresh Tokens
            var tokenString = SecurityContext.GenerateJwtToken(loggingInUser, config);
            var refreshToken = SecurityHelper.GenerateRefreshToken();

            // 🔥 FIX 2: Create the HttpOnly Cookie (XSS Protection)
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = httpContext.Request.IsHttps,
                SameSite = SameSiteMode.Strict,
                Expires = DateTime.UtcNow.AddMinutes(15)
            };
            httpContext.Response.Cookies.Append("AccessToken", tokenString, cookieOptions);

            // 🔥 FIX 3: Generate and set the Anti-CSRF Token
            var tokens = antiforgery.GetAndStoreTokens(httpContext);
            httpContext.Response.Cookies.Append("XSRF-TOKEN", tokens.RequestToken!, new CookieOptions
            {
                HttpOnly = false, // React MUST be able to read this
                Secure = httpContext.Request.IsHttps,
                SameSite = SameSiteMode.Strict
            });

            // Save Refresh token to DB
            loggingInUser.RefreshToken = refreshToken;
            loggingInUser.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
            await db.SaveChangesAsync();

            // 🔥 FIX 4: Return Success using loggingInUser properties (No tokens in the body!)
            return Results.Ok(new
            {
                Message = "Login Successful",
                Role = loggingInUser.Role.ToString(),
                Name = loggingInUser.OwnerName
            });
        });

        // ----------------------------------------------------------------------------------
        // 3. STAFF LOGIN (Password Flow)
        // ----------------------------------------------------------------------------------
        // 🔥 FIX 5: Added HttpContext and IAntiforgery here too so Staff are protected
        group.MapPost("/staff-login", async (
            StaffLoginRequest request, 
            AppDbContext db,
            HttpContext httpContext, 
            Microsoft.AspNetCore.Antiforgery.IAntiforgery antiforgery) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);

            if (user == null || user.Role == UserRole.Customer)
                return Results.Unauthorized();

            bool isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
            if (!isPasswordValid)
                return Results.Unauthorized();

            if (user.RequiresPasswordReset)
            {
                return Results.BadRequest(new
                {
                    Code = "FORCE_PASSWORD_RESET",
                    Message = "You must change your temporary password before accessing the system. Please call /api/auth/change-password."
                });
            }

            // Generate JWT and Refresh Tokens
            var tokenString = SecurityContext.GenerateJwtToken(user, config);
            var refreshToken = SecurityHelper.GenerateRefreshToken();

            // 🔥 Create the HttpOnly Cookie (XSS Protection)
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = httpContext.Request.IsHttps,
                SameSite = SameSiteMode.Strict,
                Expires = DateTime.UtcNow.AddMinutes(15)
            };
            httpContext.Response.Cookies.Append("AccessToken", tokenString, cookieOptions);

            // 🔥 Generate and set the Anti-CSRF Token
            var tokens = antiforgery.GetAndStoreTokens(httpContext);
            httpContext.Response.Cookies.Append("XSRF-TOKEN", tokens.RequestToken!, new CookieOptions
            {
                HttpOnly = false, // React MUST be able to read this
                Secure = httpContext.Request.IsHttps,
                SameSite = SameSiteMode.Strict
            });

            // Save Refresh token to DB
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
            await db.SaveChangesAsync();

            // Return Success WITHOUT the token in the body
            return Results.Ok(new
            {
                Message = "Login Successful",
                Role = user.Role.ToString(),
                Name = user.OwnerName
            });
        });

        // ----------------------------------------------------------------------------------
        // 4. CHANGE STAFF PASSWORD
        // ----------------------------------------------------------------------------------
        group.MapPost("/change-password", async (ChangePasswordRequest request, AppDbContext db) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);

            if (user == null || user.Role == UserRole.Customer)
                return Results.BadRequest("Invalid user account.");

            bool isOldPasswordValid = BCrypt.Net.BCrypt.Verify(request.OldTempPassword, user.PasswordHash);
            if (!isOldPasswordValid)
                return Results.Unauthorized();

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.RequiresPasswordReset = false;

            await db.SaveChangesAsync();

            return Results.Ok(new { Message = "Password successfully changed. You may now log in via /api/auth/staff-login." });
        });

        // ----------------------------------------------------------------------------------
        // 5. REFRESH TOKEN
        // ----------------------------------------------------------------------------------
        group.MapPost("/refresh", async (TokenRefreshRequest request, AppDbContext db, IConfiguration config) =>
        {
            var principal = SecurityContext.GetPrincipalFromExpiredToken(request.AccessToken, config);
            if (principal == null)
                return Results.BadRequest("Invalid access token or token signature.");

            var userIdString = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdString, out int userId))
                return Results.BadRequest("Invalid token claims.");

            var user = await db.Users.FindAsync(userId);
            if (user == null || user.RefreshToken != request.RefreshToken || user.RefreshTokenExpiryTime <= DateTime.UtcNow)
            {
                return Results.Unauthorized();
            }

            var newAccessToken = SecurityContext.GenerateJwtToken(user, config);
            var newRefreshToken = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64));
            
            user.RefreshToken = newRefreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
            await db.SaveChangesAsync();

            return Results.Ok(new
            {
                AccessToken = newAccessToken,
                RefreshToken = newRefreshToken
            });
        });
    }
}