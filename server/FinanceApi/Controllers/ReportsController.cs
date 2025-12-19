using FinanceApi.Data;
using FinanceApi.Models.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace FinanceApi.Controllers;

[Route("api/[controller]")]
public class ReportsController : BaseController
{
    private readonly JsonStorageService _storage;
    private readonly ILogger<ReportsController> _logger;

    public ReportsController(JsonStorageService storage, ILogger<ReportsController> logger)
    {
        _storage = storage;
        _logger = logger;
    }

    [HttpGet("monthly")]
    public Task<ActionResult<MonthlyReportDto>> GetMonthlyReport([FromQuery] int year, [FromQuery] int month)
    {
        try
        {
            var userId = GetUserId();
            var startDate = new DateTime(year, month, 1);
            var endDate = startDate.AddMonths(1).AddDays(-1);

            var transactions = _storage.GetTransactionsByUserId(userId, startDate, endDate);
            var categories = _storage.GetCategoriesByUserId(userId).ToDictionary(c => c.Id, c => c.Name);

            var income = transactions.Where(t => t.Type == "Income").Sum(t => t.Amount);
            var expenses = transactions.Where(t => t.Type == "Expense").Sum(t => t.Amount);
            var balance = income - expenses;

            var byCategory = transactions
                .Where(t => t.Type == "Expense")
                .GroupBy(t => t.CategoryId)
                .Select(g => new CategoryTotalDto
                {
                    CategoryId = g.Key,
                    CategoryName = categories.GetValueOrDefault(g.Key, "Unknown"),
                    Total = g.Sum(t => t.Amount)
                })
                .ToList();

            var report = new MonthlyReportDto
            {
                Year = year,
                Month = month,
                Income = income,
                Expenses = expenses,
                Balance = balance,
                ByCategory = byCategory
            };

            return Task.FromResult<ActionResult<MonthlyReportDto>>(Ok(report));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating monthly report");
            return Task.FromResult<ActionResult<MonthlyReportDto>>(StatusCode(500, new { message = "An error occurred while generating the report" }));
        }
    }

    [HttpGet("category")]
    public Task<ActionResult<CategoryReportDto>> GetCategoryReport(
        [FromQuery] int categoryId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        try
        {
            var userId = GetUserId();
            var category = _storage.GetCategoryById(categoryId);
            
            // Allow access to public categories (UserId == null) or user's private categories
            if (category == null || (category.UserId.HasValue && category.UserId != userId))
            {
                return Task.FromResult<ActionResult<CategoryReportDto>>(NotFound(new { message = "Category not found" }));
            }

            var transactions = _storage.GetTransactionsByUserId(userId, startDate, endDate, categoryId);
            var total = transactions.Sum(t => t.Amount);

            var report = new CategoryReportDto
            {
                CategoryId = categoryId,
                CategoryName = category.Name,
                Total = total,
                TransactionCount = transactions.Count,
                Transactions = transactions.Select(t => new TransactionDto
                {
                    Id = t.Id,
                    Date = t.Date,
                    Amount = t.Amount,
                    CategoryId = t.CategoryId,
                    CategoryName = category.Name,
                    Type = t.Type,
                    Source = t.Source,
                    Notes = t.Notes
                }).ToList()
            };

            return Task.FromResult<ActionResult<CategoryReportDto>>(Ok(report));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating category report");
            return Task.FromResult<ActionResult<CategoryReportDto>>(StatusCode(500, new { message = "An error occurred while generating the report" }));
        }
    }
}

public class MonthlyReportDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public decimal Income { get; set; }
    public decimal Expenses { get; set; }
    public decimal Balance { get; set; }
    public List<CategoryTotalDto> ByCategory { get; set; } = new();
}

public class CategoryTotalDto
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public decimal Total { get; set; }
}

public class CategoryReportDto
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public decimal Total { get; set; }
    public int TransactionCount { get; set; }
    public List<TransactionDto> Transactions { get; set; } = new();
}

