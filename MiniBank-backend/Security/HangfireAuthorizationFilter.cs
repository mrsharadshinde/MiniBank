using Hangfire.Dashboard;
namespace MiniBankWallet.Security;

class HangfireAuthorizationFilter: IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var HttpContext = context.GetHttpContext();
        var user = HttpContext.User;

        return user.Identity?.IsAuthenticated == true && user.IsInRole("Admin");
    }
}