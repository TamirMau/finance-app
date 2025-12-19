using FinanceApi.Data;
using FinanceApi.Helpers;
using FinanceApi.Models;
using FinanceApi.Models.DTOs;
using Microsoft.IdentityModel.Tokens;
using System.IO;

namespace FinanceApi.Services;

public class AuthService : IAuthService
{
    private readonly IStorageService _storage;
    private readonly JwtHelper _jwtHelper;
    private readonly ILogger<AuthService> _logger;
    private readonly IWebHostEnvironment _env;

    public AuthService(IStorageService storage, JwtHelper jwtHelper, ILogger<AuthService> logger, IWebHostEnvironment env)
    {
        _storage = storage;
        _jwtHelper = jwtHelper;
        _logger = logger;
        _env = env;
    }

    public Task<AuthResponseDto> RegisterAsync(RegisterDto registerDto)
    {
        _logger.LogInformation("RegisterAsync: Checking if username exists: {Username}", registerDto.Username);
        
        // Check if username exists
        if (_storage.GetUserByUsername(registerDto.Username) != null)
        {
            _logger.LogWarning("RegisterAsync: Username already exists: {Username}", registerDto.Username);
            throw new InvalidOperationException("Username already exists");
        }

        _logger.LogInformation("RegisterAsync: Checking if email exists: {Email}", registerDto.Email);
        
        // Check if email exists
        if (_storage.GetUserByEmail(registerDto.Email) != null)
        {
            _logger.LogWarning("RegisterAsync: Email already exists: {Email}", registerDto.Email);
            throw new InvalidOperationException("Email already exists");
        }

        _logger.LogInformation("RegisterAsync: Creating new user: {Username}", registerDto.Username);
        
        var user = new User
        {
            Username = registerDto.Username,
            Email = registerDto.Email,
            PasswordHash = PasswordHasher.HashPassword(registerDto.Password),
            Salt = string.Empty, // BCrypt handles salt internally
            Role = registerDto.Role,
            CreatedAt = DateTime.UtcNow
        };

        user = _storage.CreateUser(user);
        _logger.LogInformation("RegisterAsync: User created successfully with ID: {UserId}", user.Id);

        var token = _jwtHelper.GenerateToken(user.Id, user.Username, user.Role);
        _logger.LogInformation("RegisterAsync: JWT token generated for user ID: {UserId}", user.Id);

        return Task.FromResult(new AuthResponseDto
        {
            Token = token,
            User = new UserDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                Role = user.Role
            }
        });
    }

    public Task<AuthResponseDto?> LoginAsync(LoginDto loginDto)
    {
        _logger.LogInformation("LoginAsync: Attempting to find user: {Username}", loginDto.Username);
        
        var user = _storage.GetUserByUsername(loginDto.Username);
        
        if (user == null)
        {
            _logger.LogWarning("LoginAsync: User not found: {Username}", loginDto.Username);
            return Task.FromResult<AuthResponseDto?>(null);
        }

        _logger.LogInformation("LoginAsync: User found, verifying password for user ID: {UserId}", user.Id);
        
        if (!PasswordHasher.VerifyPassword(loginDto.Password, user.PasswordHash))
        {
            _logger.LogWarning("LoginAsync: Invalid password for user ID: {UserId}, username: {Username}", 
                user.Id, loginDto.Username);
            return Task.FromResult<AuthResponseDto?>(null);
        }

        _logger.LogInformation("LoginAsync: Password verified, generating token for user ID: {UserId}", user.Id);
        
        var token = _jwtHelper.GenerateToken(user.Id, user.Username, user.Role);
        _logger.LogInformation("LoginAsync: Login successful for user ID: {UserId}, username: {Username}", 
            user.Id, user.Username);

        // Clean up old log files after successful login
        var logDirectory = Path.Combine(_env.ContentRootPath, "Logs");
        LogCleanupService.CleanupOldLogs(logDirectory, _logger);

        return Task.FromResult<AuthResponseDto?>(new AuthResponseDto
        {
            Token = token,
            User = new UserDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                Role = user.Role
            }
        });
    }
}


