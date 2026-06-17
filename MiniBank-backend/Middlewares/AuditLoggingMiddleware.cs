using System.Diagnostics;
using System.Security.Claims;
using MiniBankWallet.Data;
using MiniBankWallet.Models.Governance;

namespace MiniBankWallet.Middlewares;

public class AuditLoggingMiddleware
{
    private readonly RequestDelegate _next;

    public AuditLoggingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        // 1. Start a stopwatch to measure performance
        var stopwatch = Stopwatch.StartNew();

        // 2. Let the request pass through to your actual endpoints
        await _next(context);

        // 3. The request is done. Stop the watch.
        stopwatch.Stop();

        // 4. Gather the audit data
        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var method = context.Request.Method;
        var path = context.Request.Path;
        var statusCode = context.Response.StatusCode;
        var ipAddress = context.Connection.RemoteIpAddress?.ToString();

        // 5. Save the log to the database
        var log = new SystemLog
        {
            UserId = userId,
            Method = method,
            Path = path,
            StatusCode = statusCode,
            IpAddress = ipAddress,
            ExecutionTimeMs = stopwatch.ElapsedMilliseconds
        };

        db.SystemLogs.Add(log);
        await db.SaveChangesAsync();
    }
}