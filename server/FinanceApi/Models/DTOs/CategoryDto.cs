using System.ComponentModel.DataAnnotations;

namespace FinanceApi.Models.DTOs;

public class CategoryDto
{
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    public string Color { get; set; } = "#2196F3";

    public string Icon { get; set; } = string.Empty;

    [RegularExpression("^(Income|Expense)$", ErrorMessage = "Type must be 'Income' or 'Expense'")]
    public string Type { get; set; } = "Expense"; // Income or Expense only

    public List<string> MerchantAliases { get; set; } = new();
}

