namespace FinanceApi.Models;

public class Transaction
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public DateTime TransactionDate { get; set; } // תאריך עסקה
    public DateTime BillingDate { get; set; } // תאריך חיוב
    public DateTime AssignedMonthDate { get; set; } // תאריך שיוך לחודש - לפיו מתבצעים החישובים בדוחות
    public decimal Amount { get; set; }
    public int CategoryId { get; set; }
    public string Type { get; set; } = "Expense"; // Income or Expense
    public string MerchantName { get; set; } = string.Empty; // שם בית עסק
    public string? ReferenceNumber { get; set; } // אסמכתא / מספר שובר
    public string? CardNumber { get; set; } // מספר כרטיס (רק 4 ספרות אחרונות)
    public string Currency { get; set; } = "ILS"; // מטבע
    public int? Installments { get; set; } // מספר תשלומים (CAL)
    public string Source { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string? Branch { get; set; } // ענף/קטגוריה עסקית מתוך הקובץ
    public bool IsHalves { get; set; } = false; // מחציות
    
    // Backward compatibility - Date property maps to TransactionDate
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    [Newtonsoft.Json.JsonIgnore]
    public DateTime Date
    {
        get => TransactionDate;
        set => TransactionDate = value;
    }
}

