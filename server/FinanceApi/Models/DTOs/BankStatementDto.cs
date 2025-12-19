using System.ComponentModel.DataAnnotations;

namespace FinanceApi.Models.DTOs;

/// <summary>
/// DTO for bank account statement (עובר ושב) row
/// </summary>
public class BankStatementRowDto
{
    public decimal? Balance { get; set; } // יתרה
    
    [Required]
    public DateTime ValueDate { get; set; } // תאריך ערך
    
    public decimal? Debit { get; set; } // חובה
    
    public decimal? Credit { get; set; } // זכות
    
    public string? Reference { get; set; } // אסמכתא
    
    public string? Description { get; set; } // תיאור
    
    public string? ActionType { get; set; } // סוג פעולה
    
    public DateTime? Date { get; set; } // תאריך
    
    public string? ForBenefitOf { get; set; } // לטובת
    
    public string? For { get; set; } // עבור
}

/// <summary>
/// DTO for complete bank account statement
/// </summary>
public class BankStatementDto
{
    [Required]
    public string AccountNumber { get; set; } = string.Empty; // מספר חשבון
    
    [Required]
    public DateTime StatementDate { get; set; } // נכון לתאריך
    
    public decimal? Balance { get; set; } // יתרה (מ-I6)
    
    public List<BankStatementRowDto> Rows { get; set; } = new();
}

/// <summary>
/// Response DTO for bank statement upload
/// </summary>
public class BankStatementUploadResponseDto
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public BankStatementDto? Statement { get; set; }
    public int TotalRows { get; set; }
}

