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

builder.Services.AddCors(options =>
{
    if (builder.Environment.IsDevelopment())
    {
        // In development, allow any localhost origin dynamically
        options.AddPolicy("AllowAngularApp", policy =>
        {
            policy.SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrEmpty(origin)) return false;
                try
                {
                    var uri = new Uri(origin);
                    // Allow localhost and 127.0.0.1 with any port
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
        // In production, use specific origins from configuration
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

if (storageType.Equals("Database", StringComparison.OrdinalIgnoreCase))
{
    // PostgreSQL Connection
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    builder.Services.AddDbContext<FinanceDbContext>(options =>
        options.UseNpgsql(connectionString));
    
    builder.Services.AddScoped<IStorageService, DbStorageService>();
}
else
{
    // Default to JSON storage
    builder.Services.AddSingleton<JsonStorageService>();
    builder.Services.AddSingleton<IStorageService>(sp => sp.GetRequiredService<JsonStorageService>());
}

// Health Checks
builder.Services.AddHealthChecks();
if (storageType.Equals("Database", StringComparison.OrdinalIgnoreCase))
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
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

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Finance API v1");
        c.RoutePrefix = "swagger";
    });
}

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

app.MapControllers();

// הדפסה של ה-URL של Swagger
var logger = app.Services.GetRequiredService<ILogger<Program>>();
var port = "5001"; // Default port from launchSettings.json sslPort

// Log storage type
var currentStorageType = app.Configuration["Storage:Type"] ?? "Json";
var storageTypeInfo = currentStorageType.Equals("Database", StringComparison.OrdinalIgnoreCase) 
    ? "🗄️ Database storage (PostgreSQL)" 
    : "📄 JSON storage";
logger.LogWarning("💾 Storage: {StorageType}", storageTypeInfo);
logger.LogWarning("🚀 FinanceApi is running!");
logger.LogWarning("📖 Swagger UI available at: \u001b[32mhttps://localhost:{Port}/swagger\u001b[0m".Replace("{Port}", port));
logger.LogWarning("🌐 API Base URL: \u001b[32mhttps://localhost:{Port}\u001b[0m".Replace("{Port}", port));

app.Run();
