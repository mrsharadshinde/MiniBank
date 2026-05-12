// Namespacees 
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

// Project Specific Namespaces
using MiniBankWallet.Data;
using MiniBankWallet.Endpoints;


var builder = WebApplication.CreateBuilder(args);

// ==========================================
// 2. DEPENDENCY INJECTION (SERVICES)
// "The Toolbox" - Adding tools before the app builds
// ==========================================

// --> A. Database Setup
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=minibank.db"));

// --> B. Security & Identity Setup (JWT)
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });

// Required to make the [Authorize] or .RequireAuthorization() attributes work
builder.Services.AddAuthorization();


// ==========================================
// 3. BUILD THE APPLICATION
// ==========================================
var app = builder.Build();


// ==========================================
// 4. HTTP REQUEST PIPELINE (MIDDLEWARE)
// "The Bouncers" - Order matters here! Security MUST come before Routing.
// ==========================================

app.UseAuthentication(); // 1. Bouncer asks: "Who are you?" (Checks the Token)
app.UseAuthorization();  // 2. VIP Manager asks: "Are you allowed in here?"


// ==========================================
// 5. ROUTING & ENDPOINTS
// "The Map" - Where should requests go?
// ==========================================

// A quick test endpoint to make sure the app runs
app.MapGet("/", () => "Mini-Bank Wallet API is running!");

// Map our custom feature endpoints
app.MapAccountEndpoints();
app.MapTransferEndpoints();
app.MapAuthEndpoints(builder.Configuration);


// ==========================================
// 6. START THE SERVER
// ==========================================
app.Run();