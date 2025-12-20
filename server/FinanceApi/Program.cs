using FinanceApi.Data;
using FinanceApi.Helpers;
using FinanceApi.Middleware;
using FinanceApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using System.IO;

var builder = WebApplication.CreateBuilder(args);

// Configure logging to file
var logDirectory = Path.Combine(builder.Environment.ContentRootPath, "Logs");
if (!Directory.Exists(logDirectory))
{
    Directory.CreateDirectory(logDirectory);
}

// Add file logging - logs will be saved to Logs folder with date in filename
var logFilePath = Path.Combine(logDirectory, $"finance-api-{DateTime.Now:yyyy-MM-dd}.log");
builder.Logging.AddProvider(new FileLoggerProvider(logFilePath));

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Finance API",
        Version = "v1",
        Description = "API for Finance Management Application"
    });

    // Add JWT authentication to Swagger
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token in the text input below.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// CORS
var allowedOrigins = builder.Configuration.GetSection("CORS:AllowedOrigins").Get<string[]>()
    ?? Array.Empty<string>();

// Allow setting additional origins via environment variable CORS_ALLOWED_ORIGINS (comma-separated)
var envOrigins = Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS");
if (!string.IsNullOrEmpty(envOrigins))
{
    var extras = envOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).ToArray();
    allowedOrigins = allowedOrigins.Concat(extras).Distinct().ToArray();
}

builder.Services.AddCors(options =>
{
    if (builder.Environment.IsDevelopment())
    {
        options.AddPolicy("AllowAngularApp", policy =>
        {
            policy.SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrEmpty(origin)) return false;
                try
                {
                    var uri = new Uri(origin);
                    return uri.Scheme == "http" &&
                           (uri.Host == "localhost" || uri.Host == "127.0.0.1");
                }
                catch
                {
                    return false;
                }
            })
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
        });
    }
    else
    {
        options.AddPolicy("AllowAngularApp", policy =>
        {
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        });
    }
});

// JWT Authentication
var jwtSecret = builder.Configuration["JWT:Secret"]
    ?? "YourSuperSecretKeyForDevelopmentOnly-Minimum32Characters";
var jwtIssuer = builder.Configuration["JWT:Issuer"] ?? "FinanceApp";
var jwtAudience = builder.Configuration["JWT:Audience"] ?? "FinanceAppUsers";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization();

// Register storage services based on configuration
var storageType = builder.Configuration["Storage:Type"] ?? "Json";

// Resolve connection string with several fallbacks to support various env var names (Render uses ConnectionStrings__Default)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? builder.Configuration.GetConnectionString("Default")
    ?? builder.Configuration["ConnectionStrings:Default"]
    ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
    ?? Environment.GetEnvironmentVariable("ConnectionStrings__Default");

if (storageType.Equals("Database", StringComparison.OrdinalIgnoreCase))
{
    if (string.IsNullOrEmpty(connectionString))
    {
        var loggerMissing = builder.Services.BuildServiceProvider().GetRequiredService<ILogger<Program>>();
        loggerMissing.LogWarning("Database storage selected but no connection string was found in configuration or environment variables.");
    }

    builder.Services.AddDbContext<FinanceDbContext>(options =>
        options.UseNpgsql(connectionString));

    builder.Services.AddScoped<IStorageService, DbStorageService>();
}
else
{
    builder.Services.AddSingleton<JsonStorageService>();
    builder.Services.AddSingleton<IStorageService>(sp => sp.GetRequiredService<JsonStorageService>());
}

// Health Checks
builder.Services.AddHealthChecks();
if (storageType.Equals("Database", StringComparison.OrdinalIgnoreCase))
{
    if (!string.IsNullOrEmpty(connectionString))
    {
        builder.Services.AddHealthChecks()
            .AddNpgSql(
                connectionString,
                name: "database",
                tags: new[] { "database", "ready" });
    }
}

// Register other services
builder.Services.AddScoped<JwtHelper>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ITransactionService, TransactionService>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<ICreditCardFileParserService, CreditCardFileParserService>();
builder.Services.AddScoped<IBankStatementParserService, BankStatementParserService>();

var app = builder.Build();

// Middleware pipeline
app.UseCors("AllowAngularApp");
app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseAuthentication();
app.UseAuthorization();

// Health Check endpoints
app.MapHealthChecks("/health");
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("database")
});
app.MapHealthChecks("/health/live");
app.MapHealthChecks("/healthz"); // תואם ל-Render

// Root endpoint
app.MapGet("/", () => Results.Ok("Finance API is running!"));

// Swagger גם ב-Production
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Finance API v1");
    c.RoutePrefix = "swagger";
});

app.MapControllers();

// הדפסה של ה-URL של Swagger
var logger = app.Services.GetRequiredService<ILogger<Program>>();
var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";

var currentStorageType = app.Configuration["Storage:Type"] ?? "Json";
var storageTypeInfo = currentStorageType.Equals("Database", StringComparison.OrdinalIgnoreCase)
    ? "🗄️ Database storage (PostgreSQL)"
    : "📄 JSON storage";

logger.LogWarning("💾 Storage: {StorageType}", storageTypeInfo);
logger.LogWarning("🚀 FinanceApi is running!");
logger.LogWarning("📖 Swagger UI available at: https://localhost:{Port}/swagger".Replace("{Port}", port));
logger.LogWarning("🌐 API Base URL: https://localhost:{Port}".Replace("{Port}", port));

// Log effective CORS allowed origins on startup for easier debugging
app.Lifetime.ApplicationStarted.Register(() =>
{
    var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
    startupLogger.LogInformation("CORS Allowed Origins: {Origins}", string.Join(", ", allowedOrigins));
});

app.Run();