using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using MiniBankWallet.Data;
using MiniBankWallet.Models.Identity;

namespace MiniBankWallet.Endpoints;

// single DTOs for our JSON payloads 
public record OtpRequest(string LoginId);
public record VerifyOtpRequest(string LoginId, string Otp);

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app, IConfiguration config)
    {
        var group = app.MapGroup("/api/auth");

        // ==================================================================================
        // 1. Reuest Otp
        group.MapPost("/request-otp", async (
            OtpRequest request, 
            AppDbContext db, 
            IMemoryCache cache) =>

        {
            // 1 . Read LoginId 
            string loginId = request.LoginId.Trim();

            User? requestingUser = null;

            // 2. look if MobileNumber or Email 

            requestingUser = await db.Users.FirstOrDefaultAsync(u =>
            u.MobileNumber == request.LoginId || u.Email == request.LoginId);

            //3. if not found with MobileNumber or email- look for the AccountNumber
            if (requestingUser == null)
            {
                var account = await db.BankAccounts
                    .Include(b => b.User)
                    .FirstOrDefaultAsync(b => b.AccountNumber == loginId);

                if (account != null)
                {
                    requestingUser = account.User;
                }

            }

            if (requestingUser == null)
            {
                return Results.BadRequest("User or Account not found ");
            }
            //4 Genreate 6 digit OTP  and save valid for 2 minites 
            var OTP = new Random().Next(100000, 999999).ToString();
            cache.Set(request.LoginId, OTP, TimeSpan.FromMinutes(2));

            //5. Simulate sending the SMS (In realityn you'd call AWS SNS or Twilio here )
            Console.WriteLine($"\n[SMS SIMULATOR ] TO : {requestingUser.MobileNumber} | Your MiniBank OTP is: {OTP}\n");
            return Results.Ok(new { Message = "OTP sent successfully. It expires in 3 minutes" });
        });

        // 2 ==================================================================================
        // step 2  varify the otp 
        group.MapPost("/Verify-otp", async (
            VerifyOtpRequest request, 
            AppDbContext db, 
            IMemoryCache cache) =>
        {
            // 1. ==============================
            // 1 check if the OTP exits in the cache for this identifier 
            if (!cache.TryGetValue(request.LoginId, out string? savedOtp))
            {
                return Results.BadRequest("OTP expired or not requested.");
            }

            // 2 check if the otp matches what the user typed 
            if (savedOtp != request.Otp.Trim())
            {
                return Results.Unauthorized();
            }

            //3. OTP is correct! Delte it form the cache so it can't be reused (Replay Attack Prevention)
            cache.Remove(request.LoginId);

            //4 Fetch the account to build the token 
                // with with email or MobileNumber
            User ? loggingInUser = await db.Users.FirstOrDefaultAsync( u =>
            u.Email == request.LoginId || u.MobileNumber == request.LoginId );
                
             // if not found with email or MobileNumber, check for account number 
            if (loggingInUser == null)
            {
                var account = await db.BankAccounts
                    .Include(b => b.User)
                    .FirstOrDefaultAsync(b => b.AccountNumber == request.LoginId);
                
                if(account != null) 
                {
                    loggingInUser = account.User;
                }
            }

            // If the user STILL wasn't found, stop here and return an error.
            if (loggingInUser == null)
            {
                return Results.BadRequest("Invalid Login ID. User not found."); 
                // Alternatively, you can use: return Results.Unauthorized();
            }
            
            //5 Build the token using USER ID and standard Role Claim
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, loggingInUser.Id.ToString()),
                new Claim("name", loggingInUser.OwnerName),
                new Claim(ClaimTypes.Role, loggingInUser.Role.ToString())
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: config["Jwt:Issuer"],
                audience: config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(1),
                signingCredentials: creds
            );

            var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
            return Results.Ok(new { Token = tokenString });
        });

    }
}