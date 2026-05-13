using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using MiniBankWallet.Data;

namespace MiniBankWallet.Endpoints;

// single DTOs for our JSON payloads 
public record OtpRequest(string Identifier);
public record VerifyOtpRequest(string Identifier, string Otp);

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app, IConfiguration config)
    {
        var group = app.MapGroup("/api/auth");

        // ==================================================================================
        // 1. Reuest Otp
        group.MapPost("/request-otp", async (OtpRequest request, AppDbContext db, IMemoryCache cache) =>

        {
           // 1. Find the user by Account Id or MobileNumber
           var account = await db.Accounts.FirstOrDefaultAsync(a => 
            a.MobileNumber == request.Identifier ||
            a.AccountNumber.ToString() == request.Identifier);

            if (account is null)
                return Results.NotFound("Account Not found");

            // 2. Genreate A random 6-digit Otp
            var otp = new Random().Next(100000, 999999).ToString();

            //3. Save it to the server's RAM for exactly 3 minutes 
            cache.Set(request.Identifier, otp, TimeSpan.FromMinutes(3));

            //4. Simulate sending the SMS (In realityn you'd call AWS SNS or Twilio here )
            Console.WriteLine($"\n[SMS SIMULATOR ] TO : {account.MobileNumber} | Your MiniBank OTP is: {otp}\n");
            return Results.Ok(new {Message = "OTP sent successfully. It expires in 3 minutes"}); 
        });

        // 2 ==================================================================================
        // step 2  varify the otp 
        group.MapPost("/Verify-otp", async (VerifyOtpRequest request , AppDbContext db, IMemoryCache cache) =>
        {
           // 1. ==============================
           // 1 check if the OTP exits in the cache for this identifier 
           if (!cache.TryGetValue(request.Identifier, out string? savedOtp))
            {
                return Results.BadRequest("OTP expired or not requested.");
            } 

            // 2 check if the otp matches what the user typed 
            if (savedOtp != request.Otp.Trim())
            {
                return Results.Unauthorized();
            }

            //3. OTP is correct! Delte it form the cache so it can't be reused (Replay Attack Prevention)
            cache.Remove(request.Identifier);

            //4 Fetch the account to build the token 
            var account = await db.Accounts.FirstOrDefaultAsync(a => 
                a.MobileNumber == request.Identifier || 
                a.AccountNumber.ToString() == request.Identifier);

            if (account is null ) return Results.NotFound();

            //5 Build the token 
            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, account.Id.ToString()),
                new Claim("name", account.OwnerName)
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
             return Results.Ok(new {Token = tokenString});
        });

    }
}