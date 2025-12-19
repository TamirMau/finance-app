using FinanceApi.Models;
using FinanceApi.Models.DTOs;

namespace FinanceApi.Data;

public interface IStorageService
{
    // User operations
    User? GetUserById(int id);
    User? GetUserByUsername(string username);
    User? GetUserByEmail(string email);
    User CreateUser(User user);
    void UpdateUser(User user);
    
    // Category operations
    Category? GetCategoryById(int id);
    List<Category> GetCategoriesByUserId(int userId);
    List<Category> GetPublicCategories();
    Category? FindPublicCategoryByName(string name);
    Category CreateCategory(Category category);
    void UpdateCategory(Category category);
    bool DeleteCategory(int id);
    bool CategoryHasTransactions(int categoryId);
    
    // Transaction operations
    Transaction? GetTransactionById(int id);
    List<Transaction> GetTransactionsByUserId(int userId, DateTime? startDate = null, DateTime? endDate = null, int? categoryId = null, string? type = null);
    (List<Transaction> Data, int TotalCount) GetTransactionsByUserIdPaged(int userId, int page, int pageSize, DateTime? startDate = null, DateTime? endDate = null, int? categoryId = null, string? type = null);
    Transaction CreateTransaction(Transaction transaction);
    void UpdateTransaction(Transaction transaction);
    bool DeleteTransaction(int id);
    int DeleteTransactionsByMonthAndCard(int userId, DateTime assignedMonthDate, string? cardNumber);
    List<Transaction> DeleteAndCreateTransactions(int userId, DateTime assignedMonthDate, string? cardNumber, List<Transaction> newTransactions);
    
    // UserSettings operations
    UserSettings? GetUserSettings(int userId);
    UserSettings CreateOrUpdateUserSettings(UserSettings settings);
    
    // BankStatement operations
    BankStatement? GetBankStatementByUserId(int userId);
    BankStatement SaveOrUpdateBankStatement(int userId, BankStatementDto dto);
    
    // Reload data (optional - mainly for JSON storage)
    void ReloadData();
}

