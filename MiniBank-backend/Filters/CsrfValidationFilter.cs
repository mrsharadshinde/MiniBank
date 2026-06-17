using Microsoft.AspNetCore.Antiforgery;

namespace MiniBankWallet.Filters;

public class CsrfValidationFilter : IEndpointFilter
{
    private readonly IAntiforgery _antiforgery;

    public CsrfValidationFilter(IAntiforgery antiforgery)
    {
        _antiforgery = antiforgery;
    }

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        try
        {
            // This manually triggers the CSRF validation for .NET 6/7!
            await _antiforgery.ValidateRequestAsync(context.HttpContext);
            
            // If the token is valid, continue to the endpoint
            return await next(context);
        }
        catch (AntiforgeryValidationException)
        {
            // If the token is missing or a hacker sent it, block the request!
            return Results.BadRequest(new { Message = "CSRF validation failed." });
        }
    }
}