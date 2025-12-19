using System.ComponentModel.DataAnnotations.Schema;

namespace FinanceApi.Models;

public class BankStatement
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string AccountNumber { get; set; } = string.Empty;
    public DateTime StatementDate { get; set; }
    public decimal? Balance { get; set; }
    public List<BankStatementRow> Rows { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class BankStatementRow
{
    public int Id { get; set; }
    public int BankStatementId { get; set; }
    public BankStatement? BankStatement { get; set; }
    public decimal? Balance { get; set; }
    public DateTime ValueDate { get; set; }
    public decimal? Debit { get; set; }
    public decimal? Credit { get; set; }
    public string? Reference { get; set; }
    public string? Description { get; set; }
    public string? ActionType { get; set; }
    public DateTime Date { get; set; }
    [NotMapped]
    public string? ForBenefitOf { get; set; } // לטובת

    [NotMapped]
    public string? For { get; set; } // עבור
}

