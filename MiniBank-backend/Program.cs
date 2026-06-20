// Namespacees 
using System.Text;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Hangfire.Dashboard;
// Project Specific Namespaces
using MiniBankWallet.Data;
using MiniBankWallet.Endpoints;
using MiniBankWallet.Services;
using MiniBankWallet.Security;

using MiniBankWallet.Services.interfaces;

// Hangfire for the backgroud service of OTP 
using Hangfire;

// Rate limiting 
using System.Threading.RateLimiting;
using Microsoft.OpenApi;

public partial class Program
{
    private static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // Allow our React frontend to talk to this API
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowFrontend", policy =>
            {
                policy.WithOrigins("http://localhost:5173") // Your React app URL
                      .AllowAnyHeader()
                      .AllowAnyMethod()
                      .AllowCredentials();
            });
        });

        // ==========================================
        // 2. DEPENDENCY INJECTION (SERVICES)
        // "The Toolbox" - Adding tools before the app builds
        // ==========================================

        // --> A. Database Setup
        builder.Services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

        builder.Services.AddMemoryCache();

        // for data Validators 
        builder.Services.AddValidatorsFromAssemblyContaining<Program>();

        // Add Backgroud Workers
        builder.Services.AddHostedService<MiniBankWallet.Workers.DailyInterestWorker>();
        // ############################   Add Hangfire to the services container for OTP
        builder.Services.AddHangfire(configuration => configuration
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UseSqlServerStorage(builder.Configuration.GetConnectionString("DefaultConnection")));

        // Add the Hangfire processing server
        builder.Services.AddHangfireServer();
        // Registering the Notification Service
        // ==========================================
        // ENVIRONMENT-AWARE DEPENDENCY INJECTION
        // ==========================================
        if (!builder.Environment.IsDevelopment())
        {

            builder.Services.AddScoped<INotificationService, BankNotificationService>();
            Console.WriteLine("--> Running in PRODUCTION mode: LIVE Twilio/SendGrid active.");
        }
        else
        {

            builder.Services.AddScoped<INotificationService, MockNotificationService>();
            Console.WriteLine("--> Running in DEVELOPMENT mode: Notifications are MOCKED.");
        }
        // ############################  OTP Rate Limiting  configuration 
        builder.Services.AddRateLimiter(options =>
        {
            options.AddPolicy("OtpRateLimit", Context =>
            {
                // Identify the user by their IP Address
                var ipAddress = Context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

                return RateLimitPartition.GetFixedWindowLimiter(ipAddress, _ =>
                new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 3,                  // Maximum 3 requests...
                    Window = TimeSpan.FromMinutes(1), // ...per 1 minute window
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0
                });
            });
            // Format the error message when someone gets blocked
            options.OnRejected = async (context, token) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                await context.HttpContext.Response.WriteAsJsonAsync(new
                {
                    Error = "Too many OTP requests. Please wait 60 seconds and try again."
                }, token);
            };
        });


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

                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken =  context.Request.Cookies["AccessToken"];

                        // if the cookie exists, Hand it ot the JWT Validator 
                        if (!string.IsNullOrWhiteSpace(accessToken))
                        {
                            context.Token = accessToken;
                        }
                        return Task.CompletedTask;
                    }
                };
            });

        // Required to make the [Authorize] or .RequireAuthorization() attributes work
        builder.Services.AddAuthorization(
            options =>
        {
            // Define the "AdminOnly" policy
            options.AddPolicy("AdminOnly", policy =>
                policy.RequireRole("Admin"));

            // Define the "StaffOnly" policy (for later use)
            options.AddPolicy("StaffOnly", policy =>
                policy.RequireRole("Teller", "Admin"));
        }
        );


        // ##########################################
        // for the Excel Processing 
        builder.Services.AddScoped<ExcelProcessingService>();
        builder.Services.AddScoped<IBulkProcessingService, BulkProcessingService>();

        // #########################################################
        // Swagger swaggerBucker UI 
        // =============================================================/
        builder.Services.AddEndpointsApiExplorer();
        // 2. Configure Swagger Generation with JWT Support
        builder.Services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "MiniBank API",
                Version = "v1",
                Description = "Enterprise-grade banking backend."
            });

            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "Bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "Enter your valid JWT token in the text input below.\r\n\r\nExample: \"eyJhbGciOiJIUzI1NiIsInR5c...\""
            });

            options.AddSecurityRequirement(doc => new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference("Bearer", doc)] = new List<string>()
            });
        });

        // 1. Add Antiforgery Services
        builder.Services.AddAntiforgery(options =>
        {
            // The header the forntend will send 
            options.HeaderName = "X-XSRF-TOKEN";

            // The cookie backend will set (must be HttpOnly)
            options.Cookie.Name = "XSRF-TOKEN";
            options.Cookie.HttpOnly = false;  // forntend neads to reads this 
            options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
                    ? CookieSecurePolicy.SameAsRequest
                    : CookieSecurePolicy.Always;
            options.Cookie.SameSite = SameSiteMode.Strict;
        });
        // #################################################################
        // 3. BUILD THE APPLICATION
        // ==========================================
        var app = builder.Build();
        // #########################################################
        // Enable middleware to serve generated Swagger as a JSON endpoint.
        // =============================================================/
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();

            app.UseSwaggerUI(options =>
            {
                options.SwaggerEndpoint("/swagger/v1/swagger.json", "MiniBank API v1");
            });
        }

        // ==========================================
        // 4. HTTP REQUEST PIPELINE (MIDDLEWARE)
        // "The Bouncers" - Order matters here! Security MUST come before Routing.
        // ==========================================

        app.UseCors("AllowFrontend"); // 0. Bouncer checks if the website is allowed to talk to us
        app.UseAuthentication();      // 1. Bouncer asks: "Who are you?" 
        app.UseAuthorization();       // 2. VIP Manager asks: "Are you allowed in here?"
        app.UseAntiforgery();

        app.UseHangfireDashboard("/hangfire", new DashboardOptions
        {
            Authorization = new[] { new HangfireAuthorizationFilter() }
        });// You can view this at http://localhost:5131/hangfire
        app.UseRateLimiter(); // OTP rate limiter 


        app.UseMiddleware<MiniBankWallet.Middlewares.AuditLoggingMiddleware>();
        // ==========================================
        // 5. ROUTING & ENDPOINTS
        // "The Map" - Where should requests go?
        // ==========================================

        // A quick test endpoint to make sure the app runs
        app.MapGet("/", () => "Mini-Bank  API is running!");

        // Map our custom feature endpoints
        app.MapAccountEndpoints();
        app.MapTransferEndpoints();
        app.MapAuthEndpoints(builder.Configuration);
        app.MapApprovalEndpoints();
        app.MapAdminEndpoints();
        app.MapAuditEndpoints();
        app.MapTellerEndpoints();
        app.MapKycEndpoints();

        // ==========================================
        // 6. START THE SERVER
        // ==========================================
        app.Run();
    }
}