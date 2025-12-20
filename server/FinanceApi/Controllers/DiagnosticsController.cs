using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using FinanceApi.Data;

namespace FinanceApi.Controllers
{
    [ApiController]
    [Route("debug")]
    public class DiagnosticsController : ControllerBase
    {
        private readonly FinanceDbContext _db;
        private readonly IConfiguration _cfg;
        private readonly ILogger<DiagnosticsController> _logger;

        public DiagnosticsController(FinanceDbContext db, IConfiguration cfg, ILogger<DiagnosticsController> logger)
        {
            _db = db;
            _cfg = cfg;
            _logger = logger;
        }

        [HttpGet("diagnostics")]
        public async Task<IActionResult> Diagnostics()
        {
            // Require a secret header so this endpoint isn't publicly exposed in production
            var secret = _cfg["Diagnostics:Secret"] ?? Environment.GetEnvironmentVariable("Diagnostics__Secret");
            if (string.IsNullOrEmpty(secret))
            {
                _logger.LogWarning("Diagnostics secret not set; diagnostics endpoint is disabled on this instance.");
                return Forbid("Diagnostics disabled on this instance.");
            }

            if (!Request.Headers.TryGetValue("X-Diagnostics-Secret", out var header) || header != secret)
            {
                _logger.LogWarning("Diagnostics access denied due to missing/invalid secret header.");
                return Unauthorized("Missing or invalid diagnostics secret.");
            }

            bool dbConnected = false;
            try
            {
                dbConnected = await _db.Database.CanConnectAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while checking DB connectivity.");
            }

            bool userExists = false;
            try
            {
                userExists = await _db.Users.AnyAsync(u => u.Username == "tamir");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while checking user existence.");
            }

            var cors = _cfg["CORS_ALLOWED_ORIGINS"] ?? _cfg["Cors:AllowedOrigins"] ?? _cfg["CORS:AllowedOrigins"] ?? "not set";

            return Ok(new { dbConnected, userExists, cors });
        }
    }
}
