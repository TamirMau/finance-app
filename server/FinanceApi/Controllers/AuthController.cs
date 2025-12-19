using FinanceApi.Models.DTOs;
using FinanceApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FinanceApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponseDto>> Register([FromBody] RegisterDto registerDto)
    {
        try
        {
            _logger.LogInformation("Registration attempt started for username: {Username}, email: {Email}", 
                registerDto.Username, registerDto.Email);

            if (!ModelState.IsValid)
            {
                _logger.LogWarning("Registration failed: Invalid model state for username: {Username}", registerDto.Username);
                return BadRequest(ModelState);
            }

            var result = await _authService.RegisterAsync(registerDto);
            
            _logger.LogInformation("Registration successful for user ID: {UserId}, username: {Username}", 
                result.User.Id, result.User.Username);
            
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Registration failed: {Message} for username: {Username}", 
                ex.Message, registerDto.Username);
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Registration error for username: {Username}, email: {Email}", 
                registerDto.Username, registerDto.Email);
            return StatusCode(500, new { message = "An error occurred during registration" });
        }
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginDto loginDto)
    {
        try
        {
            _logger.LogInformation("Login attempt started for username: {Username}", loginDto.Username);

            if (!ModelState.IsValid)
            {
                _logger.LogWarning("Login failed: Invalid model state for username: {Username}", loginDto.Username);
                return BadRequest(ModelState);
            }

            var result = await _authService.LoginAsync(loginDto);
            
            if (result == null)
            {
                _logger.LogWarning("Login failed: Invalid credentials for username: {Username}", loginDto.Username);
                return Unauthorized(new { message = "Invalid username or password" });
            }

            _logger.LogInformation("Login successful for user ID: {UserId}, username: {Username}", 
                result.User.Id, result.User.Username);
            
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Login error for username: {Username}", loginDto.Username);
            return StatusCode(500, new { message = "An error occurred during login" });
        }
    }

    [HttpGet("test")]
    [AllowAnonymous]
    public IActionResult Test()
    {
        return Ok(new { 
            message = "API is working!", 
            timestamp = DateTime.UtcNow,
            environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Unknown"
        });
    }
}

