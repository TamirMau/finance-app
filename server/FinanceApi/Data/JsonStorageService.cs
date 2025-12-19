using FinanceApi.Models;
using FinanceApi.Models.DTOs;
using FinanceApi.Helpers;
using Newtonsoft.Json;
using System.Collections.Concurrent;

namespace FinanceApi.Data;

public class JsonStorageService : IStorageService
{
    private readonly string _dataPath;
    private readonly ConcurrentDictionary<int, User> _users = new();
    private readonly ConcurrentDictionary<int, Category> _categories = new();
    private readonly ConcurrentDictionary<int, Transaction> _transactions = new();
    private readonly ConcurrentDictionary<int, UserSettings> _userSettings = new();
    private readonly ConcurrentDictionary<int, BankStatement> _bankStatements = new();
    private int _nextUserId = 1;
    private int _nextCategoryId = 1;
    private int _nextTransactionId = 1;
    private int _nextBankStatementId = 1;
    private readonly object _lock = new();

    public JsonStorageService(IWebHostEnvironment env)
    {
        // Always use the Data folder in the project root, not in bin/Debug
        // Try to find the project root by going up from ContentRootPath
        var contentRoot = env.ContentRootPath;
        var projectRoot = contentRoot;
        
        // If we're in bin/Debug/net9.0, go up to project root
        if (contentRoot.Contains("bin" + Path.DirectorySeparatorChar + "Debug"))
        {
            var binIndex = contentRoot.IndexOf("bin" + Path.DirectorySeparatorChar + "Debug");
            projectRoot = contentRoot.Substring(0, binIndex);
        }
        
        // Use the Data folder in project root
        _dataPath = Path.Combine(projectRoot, "Data", "storage.json");
        LoadData();
    }

    // פונקציה ציבורית לרענון הנתונים מהקובץ
    public void ReloadData()
    {
        lock (_lock)
        {
            // נקה את כל הנתונים הקיימים
            _users.Clear();
            _categories.Clear();
            _transactions.Clear();
            _userSettings.Clear();
            _nextUserId = 1;
            _nextCategoryId = 1;
            _nextTransactionId = 1;
            
            // טען מחדש מהקובץ
            LoadData();
        }
    }

    private void LoadData()
    {
        try
        {
            if (File.Exists(_dataPath))
            {
                var json = File.ReadAllText(_dataPath);
                var data = JsonConvert.DeserializeObject<StorageData>(json);
                
                if (data != null)
                {
                    foreach (var user in data.Users)
                    {
                        _users.TryAdd(user.Id, user);
                        if (user.Id >= _nextUserId) _nextUserId = user.Id + 1;
                    }
                    
                    foreach (var category in data.Categories)
                    {
                        // Migration: Set default Type for existing categories
                        if (string.IsNullOrEmpty(category.Type))
                        {
                            category.Type = "Expense";
                        }
                        _categories.TryAdd(category.Id, category);
                        if (category.Id >= _nextCategoryId) _nextCategoryId = category.Id + 1;
                    }
                    
                    foreach (var transaction in data.Transactions)
                    {
                        // Migration: If old transaction has Date but not TransactionDate, migrate it
                        if (transaction.TransactionDate == default && transaction.Date != default)
                        {
                            transaction.TransactionDate = transaction.Date;
                            transaction.BillingDate = transaction.Date;
                        }
                        // If TransactionDate exists but BillingDate doesn't, set it
                        if (transaction.TransactionDate != default && transaction.BillingDate == default)
                        {
                            transaction.BillingDate = transaction.TransactionDate;
                        }
                        // Migration: If AssignedMonthDate doesn't exist, set it to TransactionDate (first day of month)
                        if (transaction.AssignedMonthDate == default && transaction.TransactionDate != default)
                        {
                            transaction.AssignedMonthDate = new DateTime(transaction.TransactionDate.Year, transaction.TransactionDate.Month, 1);
                        }
                        // Set default values for new fields if missing
                        if (string.IsNullOrEmpty(transaction.MerchantName))
                        {
                            transaction.MerchantName = transaction.Source ?? string.Empty;
                        }
                        if (string.IsNullOrEmpty(transaction.Currency))
                        {
                            transaction.Currency = "ILS";
                        }
                        
                        _transactions.TryAdd(transaction.Id, transaction);
                        if (transaction.Id >= _nextTransactionId) _nextTransactionId = transaction.Id + 1;
                    }
                    
                    if (data.UserSettings != null)
                    {
                        foreach (var settings in data.UserSettings)
                        {
                            _userSettings.TryAdd(settings.UserId, settings);
                        }
                    }
                    
                    if (data.BankStatements != null)
                    {
                        foreach (var bankStatement in data.BankStatements)
                        {
                            _bankStatements.TryAdd(bankStatement.Id, bankStatement);
                            if (bankStatement.Id >= _nextBankStatementId) _nextBankStatementId = bankStatement.Id + 1;
                        }
                    }
                    
                    // Initialize income categories for each user if they don't exist
                    // Do this AFTER transactions are loaded so we can check if categories are used
                    var incomeCategoriesCreated = false;
                    foreach (var user in data.Users)
                    {
                        var userCategories = _categories.Values.Where(c => c.UserId == user.Id).ToList();
                        var userTransactions = _transactions.Values.Where(t => t.UserId == user.Id).ToList();
                        var incomeCategoryNames = new[] { "משכורת", "שכר דירה", "ביטוח לאומי", "אחר" };
                        
                        foreach (var incomeName in incomeCategoryNames)
                        {
                            // Check if income category already exists (exact name or with "(הכנסה)" suffix)
                            var existingIncomeCategory = userCategories.FirstOrDefault(c => 
                                c.Type == "Income" && 
                                (c.Name == incomeName || c.Name == incomeName + " (הכנסה)"));
                            if (existingIncomeCategory != null)
                            {
                                continue; // Income category already exists
                            }
                            
                            // Check if category exists with this name but different type
                            var existingCategory = userCategories.FirstOrDefault(c => c.Name == incomeName);
                            if (existingCategory != null)
                            {
                                // Check if this category is used in transactions
                                var isUsedInTransactions = userTransactions.Any(t => t.CategoryId == existingCategory.Id);
                                
                                if (!isUsedInTransactions && existingCategory.Type != "Income")
                                {
                                    // Category exists but not used, update it to Income
                                    existingCategory.Type = "Income";
                                    _categories[existingCategory.Id] = existingCategory;
                                    incomeCategoriesCreated = true;
                                }
                                else if (isUsedInTransactions)
                                {
                                    // Category is used, create a new one with suffix for income
                                    var usedColors = userCategories.Select(c => c.Color).Where(c => !string.IsNullOrEmpty(c) && c != "#2196F3" && c != "#000000").ToList();
                                    var incomeCategory = new Category
                                    {
                                        Id = _nextCategoryId++,
                                        UserId = user.Id,
                                        Name = incomeName + " (הכנסה)",
                                        Color = CategoryColorPalette.GetNextAvailableColor(usedColors),
                                        Icon = string.Empty,
                                        Type = "Income",
                                        MerchantAliases = new List<string>()
                                    };
                                    _categories.TryAdd(incomeCategory.Id, incomeCategory);
                                    incomeCategoriesCreated = true;
                                }
                            }
                            else
                            {
                                // Create new income category
                                var usedColors = userCategories.Select(c => c.Color).Where(c => !string.IsNullOrEmpty(c) && c != "#2196F3" && c != "#000000").ToList();
                                var incomeCategory = new Category
                                {
                                    Id = _nextCategoryId++,
                                    UserId = user.Id,
                                    Name = incomeName,
                                    Color = CategoryColorPalette.GetNextAvailableColor(usedColors),
                                    Icon = string.Empty,
                                    Type = "Income",
                                    MerchantAliases = new List<string>()
                                };
                                _categories.TryAdd(incomeCategory.Id, incomeCategory);
                                incomeCategoriesCreated = true;
                            }
                        }
                    }
                    
                    // Save if new categories were created or updated
                    if (incomeCategoriesCreated)
                    {
                        SaveData();
                    }
                }
            }
        }
        catch (Exception ex)
        {
            // Log error or handle as needed
            Console.WriteLine($"Error loading data: {ex.Message}");
        }
    }

    private void SaveData()
    {
        try
        {
            var directory = Path.GetDirectoryName(_dataPath);
            if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var data = new StorageData
            {
                Users = _users.Values.ToList(),
                Categories = _categories.Values.ToList(),
                Transactions = _transactions.Values.ToList(),
                UserSettings = _userSettings.Values.ToList(),
                BankStatements = _bankStatements.Values.ToList()
            };

            var json = JsonConvert.SerializeObject(data, Formatting.Indented);
            File.WriteAllText(_dataPath, json);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error saving data: {ex.Message}");
        }
    }

    // User operations
    public User? GetUserById(int id) => _users.TryGetValue(id, out var user) ? user : null;
    
    public User? GetUserByUsername(string username) => _users.Values.FirstOrDefault(u => u.Username == username);
    
    public User? GetUserByEmail(string email) => _users.Values.FirstOrDefault(u => u.Email == email);
    
    public User CreateUser(User user)
    {
        lock (_lock)
        {
            user.Id = _nextUserId++;
            _users.TryAdd(user.Id, user);
            SaveData();
            return user;
        }
    }

    public void UpdateUser(User user)
    {
        if (_users.ContainsKey(user.Id))
        {
            _users[user.Id] = user;
            SaveData();
        }
    }

    // Category operations
    public Category? GetCategoryById(int id) => _categories.TryGetValue(id, out var category) ? category : null;
    
    // מחזיר קטגוריות ציבוריות (UserId == null) + קטגוריות פרטיות של המשתמש (UserId == userId)
    public List<Category> GetCategoriesByUserId(int userId) => _categories.Values
        .Where(c => c.UserId == null || c.UserId == userId)
        .ToList();
    
    // מחזיר קטגוריות ציבוריות בלבד (ללא UserId)
    public List<Category> GetPublicCategories() => _categories.Values
        .Where(c => c.UserId == null)
        .ToList();
    
    // מחפש קטגוריה ציבורית לפי שם (למניעת כפילויות בעת טעינת קבצים)
    public Category? FindPublicCategoryByName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return null;
            
        return _categories.Values.FirstOrDefault(c => 
            c.UserId == null && 
            (c.Name.Equals(name, StringComparison.OrdinalIgnoreCase) ||
             (c.MerchantAliases != null && c.MerchantAliases.Any(a => a.Equals(name, StringComparison.OrdinalIgnoreCase)))));
    }
    
    public Category CreateCategory(Category category)
    {
        lock (_lock)
        {
            category.Id = _nextCategoryId++;
            _categories.TryAdd(category.Id, category);
            SaveData();
            return category;
        }
    }

    public void UpdateCategory(Category category)
    {
        if (_categories.ContainsKey(category.Id))
        {
            _categories[category.Id] = category;
            SaveData();
        }
    }

    public bool DeleteCategory(int id)
    {
        if (_categories.TryRemove(id, out _))
        {
            SaveData();
            return true;
        }
        return false;
    }

    public bool CategoryHasTransactions(int categoryId) => _transactions.Values.Any(t => t.CategoryId == categoryId);

    // Transaction operations
    public Transaction? GetTransactionById(int id) => _transactions.TryGetValue(id, out var transaction) ? transaction : null;
    
    public List<Transaction> GetTransactionsByUserId(int userId, DateTime? startDate = null, DateTime? endDate = null, int? categoryId = null, string? type = null)
    {
        var query = BuildTransactionQuery(userId, startDate, endDate, categoryId, type);
        return query.OrderByDescending(t => t.AssignedMonthDate).ThenByDescending(t => t.TransactionDate).ToList();
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
            .OrderByDescending(t => t.AssignedMonthDate)
            .ThenByDescending(t => t.TransactionDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return (data, totalCount);
    }

    private IQueryable<Transaction> BuildTransactionQuery(int userId, DateTime? startDate, DateTime? endDate, int? categoryId, string? type)
    {
        var query = _transactions.Values.Where(t => t.UserId == userId).AsQueryable();
        
        // Use AssignedMonthDate for date filtering (this is the date used for reports and calculations)
        // When filtering by date range, compare by month and year of AssignedMonthDate, not by exact date
        // This is because AssignedMonthDate is set to the 1st of the month when uploading,
        // but we want to match it to the selected month regardless of the date range type
        if (startDate.HasValue && endDate.HasValue)
        {
            // Extract target month from startDate (it represents the selected month)
            var targetYear = startDate.Value.Year;
            var targetMonth = startDate.Value.Month;
            
            // Filter by matching year and month of AssignedMonthDate
            query = query.Where(t => 
                t.AssignedMonthDate.Year == targetYear && 
                t.AssignedMonthDate.Month == targetMonth);
        }
        else
        {
            // Fallback to exact date comparison if only one date is provided
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
        lock (_lock)
        {
            transaction.Id = _nextTransactionId++;
            _transactions.TryAdd(transaction.Id, transaction);
            SaveData();
            return transaction;
        }
    }

    public void UpdateTransaction(Transaction transaction)
    {
        if (_transactions.ContainsKey(transaction.Id))
        {
            _transactions[transaction.Id] = transaction;
            SaveData();
        }
    }

    public bool DeleteTransaction(int id)
    {
        if (_transactions.TryRemove(id, out _))
        {
            SaveData();
            return true;
        }
        return false;
    }

    /// <summary>
    /// Deletes all transactions for a user that match the assigned month date and card number (last 4 digits)
    /// </summary>
    public int DeleteTransactionsByMonthAndCard(int userId, DateTime assignedMonthDate, string? cardNumber)
    {
        lock (_lock)
        {
            var targetYear = assignedMonthDate.Year;
            var targetMonth = assignedMonthDate.Month;
            
            // Normalize card number for comparison
            var normalizedCardNumber = NormalizeCardNumber(cardNumber);
            
            // Compare by year and month only (ignore day, hour, minute, second)
            // Delete transactions that match:
            // - Same user
            // - Same month (year and month)
            // - Same card number (if card number is provided, match it; if null, delete all for that month)
            var transactionsToDelete = _transactions.Values
                .Where(t => t.UserId == userId 
                    && t.AssignedMonthDate.Year == targetYear
                    && t.AssignedMonthDate.Month == targetMonth
                    && (normalizedCardNumber == null || NormalizeCardNumber(t.CardNumber) == normalizedCardNumber))
                .ToList();
            
            int deletedCount = 0;
            foreach (var transaction in transactionsToDelete)
            {
                if (_transactions.TryRemove(transaction.Id, out _))
                {
                    deletedCount++;
                }
            }
            
            if (deletedCount > 0)
            {
                SaveData();
            }
            
            return deletedCount;
        }
    }

    /// <summary>
    /// Normalizes card number for comparison (trim, handle null/empty)
    /// </summary>
    private string? NormalizeCardNumber(string? cardNumber)
    {
        if (string.IsNullOrWhiteSpace(cardNumber))
            return null;
        return cardNumber.Trim();
    }

    /// <summary>
    /// Deletes existing transactions and creates new ones in a single atomic operation
    /// This prevents race conditions when uploading the same file twice
    /// </summary>
    public List<Transaction> DeleteAndCreateTransactions(
        int userId, 
        DateTime assignedMonthDate, 
        string? cardNumber, 
        List<Transaction> newTransactions)
    {
        lock (_lock)
        {
            var targetYear = assignedMonthDate.Year;
            var targetMonth = assignedMonthDate.Month;
            
            // Normalize card number for comparison
            var normalizedCardNumber = NormalizeCardNumber(cardNumber);
            
            // STEP 1: Delete existing transactions for this month and card FIRST
            // Delete transactions that match:
            // - Same user
            // - Same month (year and month)
            // - Same card number (if card number is provided, match it; if null, delete all for that month)
            var transactionsToDelete = _transactions.Values
                .Where(t => t.UserId == userId 
                    && t.AssignedMonthDate.Year == targetYear
                    && t.AssignedMonthDate.Month == targetMonth
                    && (normalizedCardNumber == null || NormalizeCardNumber(t.CardNumber) == normalizedCardNumber))
                .ToList();
            
            int deletedCount = 0;
            foreach (var transaction in transactionsToDelete)
            {
                if (_transactions.TryRemove(transaction.Id, out _))
                {
                    deletedCount++;
                }
            }
            
            // STEP 2: Create new transactions AFTER deletion
            // This ensures new data replaces old data
            var createdTransactions = new List<Transaction>();
            foreach (var transaction in newTransactions)
            {
                transaction.Id = _nextTransactionId++;
                _transactions.TryAdd(transaction.Id, transaction);
                createdTransactions.Add(transaction);
            }
            
            // Save once after all operations
            if (deletedCount > 0 || createdTransactions.Count > 0)
            {
                SaveData();
            }
            
            return createdTransactions;
        }
    }

    // UserSettings operations
    public UserSettings? GetUserSettings(int userId)
    {
        return _userSettings.TryGetValue(userId, out var settings) ? settings : null;
    }

    public UserSettings CreateOrUpdateUserSettings(UserSettings settings)
    {
        lock (_lock)
        {
            settings.UpdatedAt = DateTime.UtcNow;
            _userSettings.AddOrUpdate(settings.UserId, settings, (key, oldValue) => settings);
            SaveData();
            return settings;
        }
    }

    // BankStatement operations
    public BankStatement? GetBankStatementByUserId(int userId)
    {
        return _bankStatements.Values.FirstOrDefault(bs => bs.UserId == userId);
    }

    public BankStatement SaveOrUpdateBankStatement(int userId, BankStatementDto dto)
    {
        lock (_lock)
        {
            // Delete existing bank statement for this user
            var existing = _bankStatements.Values.FirstOrDefault(bs => bs.UserId == userId);
            if (existing != null)
            {
                _bankStatements.TryRemove(existing.Id, out _);
            }

            // Create new bank statement
            var bankStatement = new BankStatement
            {
                Id = existing?.Id ?? _nextBankStatementId++,
                UserId = userId,
                AccountNumber = dto.AccountNumber,
                StatementDate = dto.StatementDate,
                Balance = dto.Balance,
                Rows = dto.Rows.Select(r => new BankStatementRow
                {
                    Balance = r.Balance,
                    ValueDate = r.ValueDate,
                    Debit = r.Debit,
                    Credit = r.Credit,
                    Reference = r.Reference,
                    Description = r.Description,
                    ActionType = r.ActionType,
                    Date = r.Date ?? r.ValueDate,
                    ForBenefitOf = r.ForBenefitOf,
                    For = r.For
                }).ToList(),
                CreatedAt = existing?.CreatedAt ?? DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _bankStatements.TryAdd(bankStatement.Id, bankStatement);
            SaveData();
            return bankStatement;
        }
    }

    private class StorageData
    {
        public List<User> Users { get; set; } = new();
        public List<Category> Categories { get; set; } = new();
        public List<Transaction> Transactions { get; set; } = new();
        public List<UserSettings> UserSettings { get; set; } = new();
        public List<BankStatement> BankStatements { get; set; } = new();
    }
}

