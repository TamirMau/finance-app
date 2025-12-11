using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

// חיבור ל-Neon
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Finance API", Version = "v1" });
});

// CORS לאנגולר
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "https://finance-app-2fvu.onrender.com")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Swagger UI
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Finance API v1");
});

app.UseHttpsRedirection();
app.UseCors("AllowAngular");

// Endpoint שמחזיר את הנתונים מהטבלה public.test
app.MapGet("/api/test", async (AppDbContext db) =>
    await db.Test.ToListAsync());

app.MapGet("/api/health", () => "OK");

app.Run();