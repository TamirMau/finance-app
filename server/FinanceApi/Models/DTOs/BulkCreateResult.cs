using FinanceApi.Models.DTOs;

namespace FinanceApi.Models.DTOs;

public class BulkCreateResult
{
    public List<TransactionDto> CreatedTransactions { get; set; } = new();
}

