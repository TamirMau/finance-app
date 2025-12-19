using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace FinanceApi.Controllers;

[ApiController]
[Authorize]
public abstract class BaseController : ControllerBase
{
    /// <summary>
    /// Gets the current user ID from the JWT token claims.
    /// This method is shared across all controllers to avoid code duplication.
    /// </summary>
    /// <returns>The user ID as an integer, or 0 if not found</returns>
    protected int GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.Parse(userIdClaim ?? "0");
    }
}

