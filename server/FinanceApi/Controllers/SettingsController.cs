using FinanceApi.Data;
using FinanceApi.Models;
using FinanceApi.Models.DTOs;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;

namespace FinanceApi.Controllers;

[Route("api/[controller]")]
public class SettingsController : BaseController
{
    private readonly IStorageService _storage;
    private readonly ILogger<SettingsController> _logger;
    private readonly IWebHostEnvironment _env;

    public SettingsController(IStorageService storage, ILogger<SettingsController> logger, IWebHostEnvironment env)
    {
        _storage = storage;
        _logger = logger;
        _env = env;
    }

    [HttpGet]
    public ActionResult<UserSettingsDto> GetSettings()
    {
        try
        {
            var userId = GetUserId();
            var settings = _storage.GetUserSettings(userId);

            if (settings == null)
            {
                // Return default settings
                return Ok(new UserSettingsDto
                {
                    DateRangeType = "month-start",
                    SelectedMonth = null,
                    ShowHalves = false
                });
            }

            return Ok(new UserSettingsDto
            {
                DateRangeType = settings.DateRangeType,
                SelectedMonth = settings.SelectedMonth,
                ShowHalves = settings.ShowHalves
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user settings");
            return StatusCode(500, new { message = "An error occurred while retrieving settings" });
        }
    }

    [HttpPut]
    public ActionResult<UserSettingsDto> UpdateSettings([FromBody] UserSettingsDto settingsDto)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userId = GetUserId();
            var settings = new UserSettings
            {
                UserId = userId,
                DateRangeType = settingsDto.DateRangeType,
                SelectedMonth = settingsDto.SelectedMonth,
                ShowHalves = settingsDto.ShowHalves,
                UpdatedAt = DateTime.UtcNow
            };

            _storage.CreateOrUpdateUserSettings(settings);

            return Ok(new UserSettingsDto
            {
                DateRangeType = settings.DateRangeType,
                SelectedMonth = settings.SelectedMonth,
                ShowHalves = settings.ShowHalves
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user settings");
            return StatusCode(500, new { message = "An error occurred while updating settings" });
        }
    }

    // Endpoint לרענון הנתונים מהקובץ (רק ב-development)
    [HttpPost("reload-data")]
    public ActionResult ReloadData()
    {
        try
        {
            // רק ב-development mode
            if (!_env.IsDevelopment())
            {
                return Forbid("This endpoint is only available in development mode");
            }

            if (_storage is JsonStorageService jsonService)
            {
                jsonService.ReloadData();
                return Ok(new { message = "Data reloaded successfully from storage.json" });
            }
            
            return BadRequest(new { message = "Reload is only available for JSON storage" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reloading data");
            return StatusCode(500, new { message = "An error occurred while reloading data" });
        }
    }
}

