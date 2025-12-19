using FinanceApi.Data;
using FinanceApi.Models;
using FinanceApi.Models.DTOs;

namespace FinanceApi.Services;

public class TransactionService : ITransactionService
{
    private readonly IStorageService _storage;
    private readonly ILogger<TransactionService> _logger;

    public TransactionService(IStorageService storage, ILogger<TransactionService> logger)
    {
        _storage = storage;
        _logger = logger;
    }

    public Task<List<TransactionDto>> GetTransactionsAsync(int userId, DateTime? startDate = null, DateTime? endDate = null, int? categoryId = null, string? type = null)
    {
        var transactions = _storage.GetTransactionsByUserId(userId, startDate, endDate, categoryId, type);
        
        var categories = _storage.GetCategoriesByUserId(userId).ToDictionary(c => c.Id, c => c.Name);
        
        var dtos = transactions.Select(t => new TransactionDto
        {
            Id = t.Id,
            TransactionDate = t.TransactionDate,
            BillingDate = t.BillingDate,
            AssignedMonthDate = t.AssignedMonthDate,
            Amount = t.Amount,
            CategoryId = t.CategoryId,
            CategoryName = categories.GetValueOrDefault(t.CategoryId),
            Type = t.Type,
            MerchantName = t.MerchantName,
            ReferenceNumber = t.ReferenceNumber,
            CardNumber = t.CardNumber,
            Currency = t.Currency,
            Installments = t.Installments,
            Source = t.Source,
            Notes = t.Notes,
            Branch = t.Branch,
            IsHalves = t.IsHalves
        }).ToList();

        return Task.FromResult(dtos);
    }

    public Task<PagedResult<TransactionDto>> GetTransactionsPagedAsync(int userId, int page, int pageSize, DateTime? startDate = null, DateTime? endDate = null, int? categoryId = null, string? type = null)
    {
        var (transactions, totalCount) = _storage.GetTransactionsByUserIdPaged(userId, page, pageSize, startDate, endDate, categoryId, type);
        
        var categories = _storage.GetCategoriesByUserId(userId).ToDictionary(c => c.Id, c => c.Name);
        
        var dtos = transactions.Select(t => new TransactionDto
        {
            Id = t.Id,
            TransactionDate = t.TransactionDate,
            BillingDate = t.BillingDate,
            AssignedMonthDate = t.AssignedMonthDate,
            Amount = t.Amount,
            CategoryId = t.CategoryId,
            CategoryName = categories.GetValueOrDefault(t.CategoryId),
            Type = t.Type,
            MerchantName = t.MerchantName,
            ReferenceNumber = t.ReferenceNumber,
            CardNumber = t.CardNumber,
            Currency = t.Currency,
            Installments = t.Installments,
            Source = t.Source,
            Notes = t.Notes,
            Branch = t.Branch,
            IsHalves = t.IsHalves
        }).ToList();

        return Task.FromResult(new PagedResult<TransactionDto>
        {
            Data = dtos,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }

    public Task<TransactionDto?> GetTransactionByIdAsync(int id, int userId)
    {
        var transaction = _storage.GetTransactionById(id);
        
        if (transaction == null || transaction.UserId != userId)
        {
            return Task.FromResult<TransactionDto?>(null);
        }

        var category = _storage.GetCategoryById(transaction.CategoryId);

        return Task.FromResult<TransactionDto?>(new TransactionDto
        {
            Id = transaction.Id,
            TransactionDate = transaction.TransactionDate,
            BillingDate = transaction.BillingDate,
            AssignedMonthDate = transaction.AssignedMonthDate,
            Amount = transaction.Amount,
            CategoryId = transaction.CategoryId,
            CategoryName = category?.Name,
            Type = transaction.Type,
            MerchantName = transaction.MerchantName,
            ReferenceNumber = transaction.ReferenceNumber,
            CardNumber = transaction.CardNumber,
            Currency = transaction.Currency,
            Installments = transaction.Installments,
            Source = transaction.Source,
            Notes = transaction.Notes,
            Branch = transaction.Branch,
            IsHalves = transaction.IsHalves
        });
    }

    public Task<TransactionDto> CreateTransactionAsync(TransactionDto transactionDto, int userId)
    {
        // Verify category is public (UserId == null) or belongs to user
        var category = _storage.GetCategoryById(transactionDto.CategoryId);
        if (category == null || (category.UserId.HasValue && category.UserId != userId))
        {
            throw new InvalidOperationException("Category not found or does not belong to user");
        }

        // Normalize DateTimes to UTC to satisfy PostgreSQL 'timestamp with time zone' (Npgsql requires UTC DateTimes)
        transactionDto.TransactionDate = DateTime.SpecifyKind(transactionDto.TransactionDate, DateTimeKind.Utc);
        transactionDto.BillingDate = DateTime.SpecifyKind(transactionDto.BillingDate, DateTimeKind.Utc);
        if (transactionDto.AssignedMonthDate != default)
        {
            transactionDto.AssignedMonthDate = DateTime.SpecifyKind(transactionDto.AssignedMonthDate, DateTimeKind.Utc);
        }

        // If AssignedMonthDate is not set, set it to the first day of the TransactionDate month (UTC)
        if (transactionDto.AssignedMonthDate == default)
        {
            transactionDto.AssignedMonthDate = DateTime.SpecifyKind(new DateTime(transactionDto.TransactionDate.Year, transactionDto.TransactionDate.Month, 1), DateTimeKind.Utc);
        }

        // Normalize card number before storing
        var normalizedCardNumber = string.IsNullOrWhiteSpace(transactionDto.CardNumber) 
            ? null 
            : transactionDto.CardNumber.Trim();

        var transaction = new Transaction
        {
            UserId = userId,
            TransactionDate = transactionDto.TransactionDate,
            BillingDate = transactionDto.BillingDate,
            AssignedMonthDate = transactionDto.AssignedMonthDate,
            Amount = transactionDto.Amount,
            CategoryId = transactionDto.CategoryId,
            Type = transactionDto.Type,
            MerchantName = transactionDto.MerchantName,
            ReferenceNumber = transactionDto.ReferenceNumber,
            CardNumber = normalizedCardNumber,
            Currency = transactionDto.Currency,
            Installments = transactionDto.Installments,
            Source = transactionDto.Source,
            Notes = transactionDto.Notes,
            Branch = transactionDto.Branch,
            IsHalves = transactionDto.IsHalves
        };

        transaction = _storage.CreateTransaction(transaction);

        transactionDto.Id = transaction.Id;
        transactionDto.CategoryName = category.Name;

        return Task.FromResult(transactionDto);
    }

    public Task<TransactionDto?> UpdateTransactionAsync(int id, TransactionDto transactionDto, int userId)
    {
        var transaction = _storage.GetTransactionById(id);
        
        if (transaction == null || transaction.UserId != userId)
        {
            return Task.FromResult<TransactionDto?>(null);
        }

        // Verify category is public (UserId == null) or belongs to user
        var category = _storage.GetCategoryById(transactionDto.CategoryId);
        if (category == null || (category.UserId.HasValue && category.UserId != userId))
        {
            throw new InvalidOperationException("Category not found or does not belong to user");
        }

        // Normalize card number before storing
        var normalizedCardNumber = string.IsNullOrWhiteSpace(transactionDto.CardNumber) 
            ? null 
            : transactionDto.CardNumber.Trim();

        // Normalize incoming DateTimes to UTC before assigning
        transactionDto.TransactionDate = DateTime.SpecifyKind(transactionDto.TransactionDate, DateTimeKind.Utc);
        transactionDto.BillingDate = DateTime.SpecifyKind(transactionDto.BillingDate, DateTimeKind.Utc);
        if (transactionDto.AssignedMonthDate != default)
        {
            transactionDto.AssignedMonthDate = DateTime.SpecifyKind(transactionDto.AssignedMonthDate, DateTimeKind.Utc);
        }

        transaction.TransactionDate = transactionDto.TransactionDate;
        transaction.BillingDate = transactionDto.BillingDate;
        
        // Preserve AssignedMonthDate: if the new value is default/invalid, keep the existing value
        // Otherwise, if it's valid, update it. If existing is also invalid, calculate from TransactionDate
        if (transactionDto.AssignedMonthDate != default && transactionDto.AssignedMonthDate.Year > 1900)
        {
            transaction.AssignedMonthDate = transactionDto.AssignedMonthDate;
        }
        else if (transaction.AssignedMonthDate == default || transaction.AssignedMonthDate.Year <= 1900)
        {
            // If existing is also invalid, calculate from TransactionDate (ensure UTC)
            transaction.AssignedMonthDate = DateTime.SpecifyKind(new DateTime(transaction.TransactionDate.Year, transaction.TransactionDate.Month, 1), DateTimeKind.Utc);
        }
        // Otherwise, keep the existing AssignedMonthDate (don't update it)
        
        transaction.Amount = transactionDto.Amount;
        transaction.CategoryId = transactionDto.CategoryId;
        transaction.Type = transactionDto.Type;
        transaction.MerchantName = transactionDto.MerchantName;
        transaction.ReferenceNumber = transactionDto.ReferenceNumber;
        transaction.CardNumber = normalizedCardNumber;
        transaction.Currency = transactionDto.Currency;
        transaction.Installments = transactionDto.Installments;
        transaction.Source = transactionDto.Source;
        transaction.Notes = transactionDto.Notes;
        transaction.Branch = transactionDto.Branch;
        transaction.IsHalves = transactionDto.IsHalves;

        _storage.UpdateTransaction(transaction);

        transactionDto.Id = transaction.Id;
        transactionDto.CategoryName = category.Name;

        return Task.FromResult<TransactionDto?>(transactionDto);
    }

    public Task<bool> DeleteTransactionAsync(int id, int userId)
    {
        var transaction = _storage.GetTransactionById(id);
        
        if (transaction == null || transaction.UserId != userId)
        {
            return Task.FromResult(false);
        }

        return Task.FromResult(_storage.DeleteTransaction(id));
    }

    /// <summary>
    /// Bulk creates transactions with new month-based approach:
    /// 1. All transactions are assigned to the specified month (assignedMonthDate)
    /// 2. If transactions already exist for the same month and card number, they are deleted and replaced
    /// 3. All transactions from the file are imported with the assigned month date
    /// </summary>
    public Task<BulkCreateResult> BulkCreateTransactionsAsync(List<TransactionDto> transactionDtos, int userId, DateTime assignedMonthDate)
    {
        var categories = _storage.GetCategoriesByUserId(userId).ToDictionary(c => c.Id, c => c.Name);
        var result = new BulkCreateResult();
        
        // Extract card number from transactions (normalize and find most common)
        // Try to find a non-empty card number from all transactions
        // Use Distinct to find the most common card number
        string? cardNumber = transactionDtos
            .Where(t => !string.IsNullOrWhiteSpace(t.CardNumber))
            .Select(t => t.CardNumber?.Trim())
            .Distinct()
            .FirstOrDefault();
        
        // Normalize card number (trim whitespace, handle null/empty)
        cardNumber = string.IsNullOrWhiteSpace(cardNumber) ? null : cardNumber.Trim();
        
        _logger.LogInformation("BulkCreateTransactionsAsync: Extracted card number '{CardNumber}' from {Count} transactions, month: {Month}/{Year}", 
            cardNumber ?? "null", transactionDtos.Count, assignedMonthDate.Month, assignedMonthDate.Year);
        
        // Calculate month start (first day of the assigned month) and ensure UTC kind
        var monthStart = DateTime.SpecifyKind(new DateTime(assignedMonthDate.Year, assignedMonthDate.Month, 1), DateTimeKind.Utc);
        
        // Prepare all transactions for creation (validate categories first)
        var transactionsToCreate = new List<Transaction>();
        foreach (var transactionDto in transactionDtos)
        {
            // Normalize incoming DateTimes to UTC to satisfy PostgreSQL 'timestamp with time zone'
            transactionDto.TransactionDate = DateTime.SpecifyKind(transactionDto.TransactionDate, DateTimeKind.Utc);
            transactionDto.BillingDate = DateTime.SpecifyKind(transactionDto.BillingDate, DateTimeKind.Utc);
            // Set AssignedMonthDate to the first day of the assigned month (UTC)
            transactionDto.AssignedMonthDate = monthStart;

            // Verify category is public (UserId == null) or belongs to user
            var category = _storage.GetCategoryById(transactionDto.CategoryId);
            if (category == null || (category.UserId.HasValue && category.UserId != userId))
            {
                _logger.LogWarning("Category {CategoryId} not found or does not belong to user {UserId}", transactionDto.CategoryId, userId);
                continue;
            }
            
            // Normalize card number before storing
            var normalizedCardNumber = string.IsNullOrWhiteSpace(transactionDto.CardNumber) 
                ? null 
                : transactionDto.CardNumber.Trim();
            
            // Prepare transaction for creation
            var transaction = new Transaction
            {
                UserId = userId,
                TransactionDate = DateTime.SpecifyKind(transactionDto.TransactionDate, DateTimeKind.Utc),
                BillingDate = DateTime.SpecifyKind(transactionDto.BillingDate, DateTimeKind.Utc),
                AssignedMonthDate = DateTime.SpecifyKind(transactionDto.AssignedMonthDate, DateTimeKind.Utc),
                Amount = transactionDto.Amount,
                CategoryId = transactionDto.CategoryId,
                Type = transactionDto.Type,
                MerchantName = transactionDto.MerchantName,
                ReferenceNumber = transactionDto.ReferenceNumber,
                CardNumber = normalizedCardNumber,
                Currency = transactionDto.Currency,
                Installments = transactionDto.Installments,
                Source = transactionDto.Source,
                Notes = transactionDto.Notes,
                Branch = transactionDto.Branch,
                IsHalves = transactionDto.IsHalves
            };
            
            transactionsToCreate.Add(transaction);
        }
        
        // Delete existing transactions and create new ones in a single atomic operation
        // This prevents race conditions when uploading the same file twice
        var createdTransactions = _storage.DeleteAndCreateTransactions(userId, assignedMonthDate, cardNumber, transactionsToCreate);
        
        // Map created transactions back to DTOs
        // Create a set of processed transaction DTOs to avoid duplicates
        var processedDtoIds = new HashSet<int>();
        
        foreach (var createdTransaction in createdTransactions)
        {
            // Try to find matching DTO from original list
            var transactionDto = transactionDtos.FirstOrDefault(t => 
                !processedDtoIds.Contains(transactionDtos.IndexOf(t)) &&
                t.TransactionDate == createdTransaction.TransactionDate &&
                t.BillingDate == createdTransaction.BillingDate &&
                Math.Abs(t.Amount - createdTransaction.Amount) < 0.01m && // Use tolerance for decimal comparison
                t.MerchantName == createdTransaction.MerchantName &&
                (string.IsNullOrEmpty(t.ReferenceNumber) || t.ReferenceNumber == createdTransaction.ReferenceNumber));
            
            if (transactionDto != null)
            {
                var dtoIndex = transactionDtos.IndexOf(transactionDto);
                processedDtoIds.Add(dtoIndex);
                
                transactionDto.Id = createdTransaction.Id;
                transactionDto.AssignedMonthDate = createdTransaction.AssignedMonthDate;
                transactionDto.CategoryName = categories.GetValueOrDefault(createdTransaction.CategoryId);
                result.CreatedTransactions.Add(transactionDto);
            }
            else
            {
                // If no matching DTO found, create a new DTO from the created transaction
                // This handles cases where transactions were created but not in original DTOs list
                var newDto = new TransactionDto
                {
                    Id = createdTransaction.Id,
                    TransactionDate = createdTransaction.TransactionDate,
                    BillingDate = createdTransaction.BillingDate,
                    AssignedMonthDate = createdTransaction.AssignedMonthDate,
                    Amount = createdTransaction.Amount,
                    CategoryId = createdTransaction.CategoryId,
                    CategoryName = categories.GetValueOrDefault(createdTransaction.CategoryId),
                    Type = createdTransaction.Type,
                    MerchantName = createdTransaction.MerchantName,
                    ReferenceNumber = createdTransaction.ReferenceNumber,
                    CardNumber = createdTransaction.CardNumber,
                    Currency = createdTransaction.Currency,
                    Installments = createdTransaction.Installments,
                    Source = createdTransaction.Source,
                    Notes = createdTransaction.Notes,
                    Branch = createdTransaction.Branch,
                    IsHalves = createdTransaction.IsHalves
                };
                result.CreatedTransactions.Add(newDto);
            }
        }

        return Task.FromResult(result);
    }
}

