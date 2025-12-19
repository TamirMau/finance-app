using FinanceApi.Models.DTOs;

namespace FinanceApi.Services;

public interface ITransactionService
{
    Task<List<TransactionDto>> GetTransactionsAsync(int userId, DateTime? startDate = null, DateTime? endDate = null, int? categoryId = null, string? type = null);
    Task<PagedResult<TransactionDto>> GetTransactionsPagedAsync(int userId, int page, int pageSize, DateTime? startDate = null, DateTime? endDate = null, int? categoryId = null, string? type = null);
    Task<TransactionDto?> GetTransactionByIdAsync(int id, int userId);
    Task<TransactionDto> CreateTransactionAsync(TransactionDto transactionDto, int userId);
    Task<TransactionDto?> UpdateTransactionAsync(int id, TransactionDto transactionDto, int userId);
    Task<bool> DeleteTransactionAsync(int id, int userId);
    Task<BulkCreateResult> BulkCreateTransactionsAsync(List<TransactionDto> transactionDtos, int userId, DateTime assignedMonthDate);
}

