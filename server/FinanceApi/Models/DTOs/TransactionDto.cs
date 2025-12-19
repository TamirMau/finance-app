using System.ComponentModel.DataAnnotations;

namespace FinanceApi.Models.DTOs;

public class TransactionDto
{
    public int Id { get; set; }

    [Required]
    public DateTime TransactionDate { get; set; } // תאריך עסקה

    [Required]
    public DateTime BillingDate { get; set; } // תאריך חיוב

    [Required]
    public DateTime AssignedMonthDate { get; set; } // תאריך שיוך לחודש - לפיו מתבצעים החישובים בדוחות

    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than 0")]
    public decimal Amount { get; set; }

    [Required]
    public string Type { get; set; } = "Expense"; // Income or Expense

    [Required]
    [MaxLength(100)]
    public string MerchantName { get; set; } = string.Empty; // שם בית עסק

    [MaxLength(50)]
    public string? ReferenceNumber { get; set; } // אסמכתא / מספר שובר

    [MaxLength(20)]
    public string? CardNumber { get; set; } // מספר כרטיס (רק 4 ספרות אחרונות)

    [MaxLength(10)]
    public string Currency { get; set; } = "ILS"; // מטבע

    public int? Installments { get; set; } // מספר תשלומים (CAL)

    [Required]
    public int CategoryId { get; set; }

    public string? CategoryName { get; set; }

    [MaxLength(100)]
    public string Source { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Notes { get; set; }

    [MaxLength(100)]
    public string? Branch { get; set; } // ענף/קטגוריה עסקית מתוך הקובץ
    
    public bool IsHalves { get; set; } = false; // מחציות
    
    // Backward compatibility - Date property maps to TransactionDate
    [Newtonsoft.Json.JsonIgnore]
    public DateTime Date
    {
        get => TransactionDate;
        set => TransactionDate = value;
    }
}

