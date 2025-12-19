namespace FinanceApi.Models;

public class Category
{
    public int Id { get; set; }
    public int? UserId { get; set; } // null = קטגוריה ציבורית (מאקסל), לא null = קטגוריה פרטית (משתמש)
    public string Name { get; set; } = string.Empty; // שם הקטגוריה (למשל "מזון", "תחבורה")
    public string Color { get; set; } = "#2196F3";
    public string Icon { get; set; } = string.Empty;
    public string Type { get; set; } = "Expense"; // Income, Expense, or All

    // רשימת שמות חלופיים כדי למנוע כפילויות
    public List<string> MerchantAliases { get; set; } = new();
}

