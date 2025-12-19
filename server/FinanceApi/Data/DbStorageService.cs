using FinanceApi.Models;
using FinanceApi.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace FinanceApi.Data;

public class DbStorageService : IStorageService
{
    private readonly FinanceDbContext _context;
    private readonly ILogger<DbStorageService> _logger;

    public DbStorageService(FinanceDbContext context, ILogger<DbStorageService> logger)
    {
        _context = context;
        _logger = logger;
    }

    // ========== User Operations ==========
    
    public User? GetUserById(int id)
    {
        return _context.Users.Find(id);
    }

    public User? GetUserByUsername(string username)
    {
        return _context.Users.FirstOrDefault(u => u.Username == username);
    }

    public User? GetUserByEmail(string email)
    {
        return _context.Users.FirstOrDefault(u => u.Email == email);
    }

    public User CreateUser(User user)
    {
        _context.Users.Add(user);
        _context.SaveChanges();
        return user;
    }

    public void UpdateUser(User user)
    {
        _context.Users.Update(user);
        _context.SaveChanges();
    }

    // ========== Category Operations ==========
    
    public Category? GetCategoryById(int id)
    {
        return _context.Categories.Find(id);
    }

    public List<Category> GetCategoriesByUserId(int userId)
    {
        return _context.Categories
            .Where(c => c.UserId == null || c.UserId == userId)
            .AsNoTracking()
            .ToList();
    }

    public List<Category> GetPublicCategories()
    {
        return _context.Categories
            .Where(c => c.UserId == null)
            .AsNoTracking()
            .ToList();
    }

    public Category? FindPublicCategoryByName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return null;

        // Search by name or in MerchantAliases JSONB array
        // Use PostgreSQL JSONB query for better performance
        var normalizedName = name.Trim();
        
        // First try exact name match
        var category = _context.Categories
            .Where(c => c.UserId == null && c.Name == normalizedName)
            .AsNoTracking()
            .FirstOrDefault();
        
        if (category != null)
            return category;
        
        // Then search in MerchantAliases using JSONB contains
        // Load categories and filter in memory (PostgreSQL JSONB query is complex)
        var publicCategories = _context.Categories
            .Where(c => c.UserId == null)
            .AsNoTracking()
            .ToList();

        return publicCategories.FirstOrDefault(c => 
            c.MerchantAliases != null && c.MerchantAliases.Any(a => 
                a.Equals(normalizedName, StringComparison.OrdinalIgnoreCase)));
    }

    public Category CreateCategory(Category category)
    {
        _context.Categories.Add(category);
        _context.SaveChanges();
        return category;
    }

    public void UpdateCategory(Category category)
    {
        _context.Categories.Update(category);
        _context.SaveChanges();
    }

    public bool DeleteCategory(int id)
    {
        var category = _context.Categories.Find(id);
        if (category == null) return false;

        _context.Categories.Remove(category);
        _context.SaveChanges();
        return true;
    }

    public bool CategoryHasTransactions(int categoryId)
    {
        return _context.Transactions
            .AsNoTracking()
            .Any(t => t.CategoryId == categoryId);
    }

    // ========== Transaction Operations ==========
    
    public Transaction? GetTransactionById(int id)
    {
        return _context.Transactions.Find(id);
    }

    public List<Transaction> GetTransactionsByUserId(int userId, DateTime? startDate = null, DateTime? endDate = null, int? categoryId = null, string? type = null)
    {
        var query = BuildTransactionQuery(userId, startDate, endDate, categoryId, type);
        return query
            .AsNoTracking()
            .OrderByDescending(t => t.AssignedMonthDate)
            .ThenByDescending(t => t.TransactionDate)
            .ToList();
    }

    public (List<Transaction> Data, int TotalCount) GetTransactionsByUserIdPaged(int userId, int page, int pageSize, DateTime? startDate = null, DateTime? endDate = null, int? categoryId = null, string? type = null)
    {
        // Validate pagination parameters
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200); // Max 200 per page

        var query = BuildTransactionQuery(userId, startDate, endDate, categoryId, type);
        
        // Get total count
        var totalCount = query.Count();
        
        // Get paged data
        var data = query
            .AsNoTracking()
            .OrderByDescending(t => t.AssignedMonthDate)
            .ThenByDescending(t => t.TransactionDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return (data, totalCount);
    }

    private IQueryable<Transaction> BuildTransactionQuery(int userId, DateTime? startDate, DateTime? endDate, int? categoryId, string? type)
    {
        var query = _context.Transactions.Where(t => t.UserId == userId);

        // Filter by AssignedMonthDate (year and month)
        if (startDate.HasValue && endDate.HasValue)
        {
            var targetYear = startDate.Value.Year;
            var targetMonth = startDate.Value.Month;
            query = query.Where(t => 
                t.AssignedMonthDate.Year == targetYear && 
                t.AssignedMonthDate.Month == targetMonth);
        }
        else
        {
            if (startDate.HasValue)
                query = query.Where(t => t.AssignedMonthDate >= startDate.Value);
            if (endDate.HasValue)
                query = query.Where(t => t.AssignedMonthDate <= endDate.Value);
        }

        if (categoryId.HasValue)
            query = query.Where(t => t.CategoryId == categoryId.Value);

        if (!string.IsNullOrEmpty(type))
            query = query.Where(t => t.Type == type);

        return query;
    }

    public Transaction CreateTransaction(Transaction transaction)
    {
        _context.Transactions.Add(transaction);
        _context.SaveChanges();
        return transaction;
    }

    public void UpdateTransaction(Transaction transaction)
    {
        _context.Transactions.Update(transaction);
        _context.SaveChanges();
    }

    public bool DeleteTransaction(int id)
    {
        var transaction = _context.Transactions.Find(id);
        if (transaction == null) return false;

        _context.Transactions.Remove(transaction);
        _context.SaveChanges();
        return true;
    }

    public int DeleteTransactionsByMonthAndCard(int userId, DateTime assignedMonthDate, string? cardNumber)
    {
        var targetYear = assignedMonthDate.Year;
        var targetMonth = assignedMonthDate.Month;
        var normalizedCardNumber = string.IsNullOrWhiteSpace(cardNumber) ? null : cardNumber.Trim();

        var transactionsToDelete = _context.Transactions
            .Where(t => t.UserId == userId 
                && t.AssignedMonthDate.Year == targetYear
                && t.AssignedMonthDate.Month == targetMonth
                && (normalizedCardNumber == null || t.CardNumber == normalizedCardNumber))
            .ToList();

        if (transactionsToDelete.Count == 0) return 0;

        _context.Transactions.RemoveRange(transactionsToDelete);
        // Note: SaveChanges is called by the caller if needed (for atomic operations)
        // If called standalone, SaveChanges should be called after this method
        _context.SaveChanges();
        return transactionsToDelete.Count;
    }

    public List<Transaction> DeleteAndCreateTransactions(int userId, DateTime assignedMonthDate, string? cardNumber, List<Transaction> newTransactions)
    {
        using var dbTransaction = _context.Database.BeginTransaction();
        try
        {
            // Delete existing (without SaveChanges - will be saved together)
            var targetYear = assignedMonthDate.Year;
            var targetMonth = assignedMonthDate.Month;
            var normalizedCardNumber = string.IsNullOrWhiteSpace(cardNumber) ? null : cardNumber.Trim();

            var transactionsToDelete = _context.Transactions
                .Where(t => t.UserId == userId 
                    && t.AssignedMonthDate.Year == targetYear
                    && t.AssignedMonthDate.Month == targetMonth
                    && (normalizedCardNumber == null || t.CardNumber == normalizedCardNumber))
                .ToList();

            if (transactionsToDelete.Count > 0)
            {
                _context.Transactions.RemoveRange(transactionsToDelete);
            }

            // Create new
            _context.Transactions.AddRange(newTransactions);
            _context.SaveChanges();

            dbTransaction.Commit();
            return newTransactions;
        }
        catch
        {
            dbTransaction.Rollback();
            throw;
        }
    }

    // ========== UserSettings Operations ==========
    
    public UserSettings? GetUserSettings(int userId)
    {
        return _context.UserSettings
            .AsNoTracking()
            .FirstOrDefault(us => us.UserId == userId);
    }

    public UserSettings CreateOrUpdateUserSettings(UserSettings settings)
    {
        settings.UpdatedAt = DateTime.UtcNow;
        
        var existing = _context.UserSettings.Find(settings.UserId);
        if (existing != null)
        {
            existing.DateRangeType = settings.DateRangeType;
            existing.SelectedMonth = settings.SelectedMonth;
            existing.ShowHalves = settings.ShowHalves;
            existing.UpdatedAt = settings.UpdatedAt;
            _context.UserSettings.Update(existing);
        }
        else
        {
            _context.UserSettings.Add(settings);
        }
        
        _context.SaveChanges();
        return existing ?? settings;
    }

    // ========== BankStatement Operations ==========
    
    public BankStatement? GetBankStatementByUserId(int userId)
    {
        return _context.BankStatements
            .Include(bs => bs.Rows)
            .AsNoTracking()
            .FirstOrDefault(bs => bs.UserId == userId);
    }

    public BankStatement SaveOrUpdateBankStatement(int userId, BankStatementDto dto)
    {
        // Make the entire operation atomic using a database transaction so partial saves cannot occur
        using var transaction = _context.Database.BeginTransaction();
        try
        {
            var existing = _context.BankStatements
                .Include(bs => bs.Rows)
                .FirstOrDefault(bs => bs.UserId == userId);

            if (existing != null)
            {
                // Update existing
                existing.AccountNumber = dto.AccountNumber;
                existing.StatementDate = DateTime.SpecifyKind(dto.StatementDate, DateTimeKind.Utc);
                existing.Balance = dto.Balance;
                existing.UpdatedAt = DateTime.UtcNow;

                // Delete old rows
                _context.BankStatementRows.RemoveRange(existing.Rows);

                // Add new rows
                var newRows = dto.Rows.Select(r => new BankStatementRow
                {
                    BankStatementId = existing.Id,
                    Balance = r.Balance,
                    ValueDate = DateTime.SpecifyKind(r.ValueDate, DateTimeKind.Utc),
                    Debit = r.Debit,
                    Credit = r.Credit,
                    Reference = r.Reference,
                    Description = r.Description,
                    ActionType = r.ActionType,
                    Date = DateTime.SpecifyKind(r.Date ?? r.ValueDate, DateTimeKind.Utc)
                }).ToList();

                _context.BankStatementRows.AddRange(newRows);
                existing.Rows = newRows;
            }
            else
            {
                // Create new
                var bankStatement = new BankStatement
                {
                    UserId = userId,
                    AccountNumber = dto.AccountNumber,
                    StatementDate = DateTime.SpecifyKind(dto.StatementDate, DateTimeKind.Utc),
                    Balance = dto.Balance,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.BankStatements.Add(bankStatement);
                _context.SaveChanges(); // Save to get the ID

                // Add rows after BankStatement has an ID
                var newRows = dto.Rows.Select(r => new BankStatementRow
                {
                    BankStatementId = bankStatement.Id,
                    Balance = r.Balance,
                    ValueDate = DateTime.SpecifyKind(r.ValueDate, DateTimeKind.Utc),
                    Debit = r.Debit,
                    Credit = r.Credit,
                    Reference = r.Reference,
                    Description = r.Description,
                    ActionType = r.ActionType,
                    Date = DateTime.SpecifyKind(r.Date ?? r.ValueDate, DateTimeKind.Utc)
                }).ToList();

                _context.BankStatementRows.AddRange(newRows);
                bankStatement.Rows = newRows;
                existing = bankStatement;
            }

            _context.SaveChanges();
            transaction.Commit();
            return existing;
        }
        catch
        {
            // Ensure rollback on any failure and rethrow to be handled by caller
            transaction.Rollback();
            throw;
        }
    }

    // ========== Reload Data (No-op for DB) ==========
    
    public void ReloadData()
    {
        // No-op for database storage
    }
}

