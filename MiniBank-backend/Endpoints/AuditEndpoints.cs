using Microsoft.EntityFrameworkCore;
using MiniBankWallet.Data;

namespace MiniBankWallet.Endpoints;

public static class AuditEndpoints
{
    public static void MapAuditEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/audit").RequireAuthorization("AdminOnly").WithTags("Audit Trail");

        // ==========================================
        // GET AUDIT LOGS (with pagination and filtering)
        // ==========================================
        group.MapGet("/logs", async (
            AppDbContext db,
            int page = 1,
            int pageSize = 20,
            string? action = null,
            string? role = null,
            string? searchTerm = null,
            string? startDate = null,
            string? endDate = null) =>
        {
            // Validate pagination
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 20;

            var query = db.AuditLogs.AsQueryable();

            // Filter by action (exact match)
            if (!string.IsNullOrWhiteSpace(action))
                query = query.Where(a => a.Action == action);

            // Filter by role (Admin or Teller)
            if (!string.IsNullOrWhiteSpace(role))
                query = query.Where(a => a.PerformedByRole == role);

            // Search by performed user ID or target user ID
            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                if (int.TryParse(searchTerm, out int userId))
                {
                    query = query.Where(a =>
                        a.PerformedByUserId == userId ||
                        a.TargetUserId == userId);
                }
            }

            // Filter by date range
            if (DateTime.TryParse(startDate, out DateTime parsedStartDate))
            {
                query = query.Where(a => a.Timestamp >= parsedStartDate);
            }

            if (DateTime.TryParse(endDate, out DateTime parsedEndDate))
            {
                // Add one day to include the entire end date
                var endOfDay = parsedEndDate.AddDays(1).AddSeconds(-1);
                query = query.Where(a => a.Timestamp <= endOfDay);
            }

            // Get total count before pagination
            var totalCount = await query.CountAsync();

            // Get paginated results (sorted by newest first)
            var auditLogs = await query
                .OrderByDescending(a => a.Timestamp)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new
                {
                    a.Id,
                    a.PerformedByUserId,
                    a.PerformedByRole,
                    a.TargetUserId,
                    a.Action,
                    a.OldValue,
                    a.NewValue,
                    a.Timestamp
                })
                .ToListAsync();

            return Results.Ok(new
            {
                Data = auditLogs,
                Pagination = new
                {
                    CurrentPage = page,
                    PageSize = pageSize,
                    TotalCount = totalCount,
                    TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                }
            });
        });

        // ==========================================
        // GET AVAILABLE ACTIONS (for filter dropdown)
        // ==========================================
        group.MapGet("/actions", async (AppDbContext db) =>
        {
            var actions = await db.AuditLogs
                .Select(a => a.Action)
                .Distinct()
                .OrderBy(a => a)
                .ToListAsync();

            return Results.Ok(new { Actions = actions });
        });
    }
}
