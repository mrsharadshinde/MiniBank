using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using MiniBankWallet.Data;

namespace MiniBankWallet.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app, IConfiguration config)
    {
        app.MapPost("/api/auth/login", async (int accountId, AppDbContext db) =>
        {
            // 1. Verify the account exists
            var account = await db.Accounts.FindAsync(accountId);
            if (account is null) return Results.NotFound("Account not found.");

            // 2. Package the user's data (Claims)
            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, account.Id.ToString()),
                new Claim("name", account.OwnerName)
            };

            // 3. Create the cryptographic lock (Signature)
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            // 4. Assemble the final token
            var token = new JwtSecurityToken(
                issuer: config["Jwt:Issuer"],
                audience: config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(1), // Token dies in 1 minute
                signingCredentials: creds
            );

            // 5. Serialize to string and send to client
            var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

            return Results.Ok(new { Token = tokenString });
        });
    }
}