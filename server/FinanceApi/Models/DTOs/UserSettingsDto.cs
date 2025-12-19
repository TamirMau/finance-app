namespace FinanceApi.Models.DTOs;

public class UserSettingsDto
{
    public string DateRangeType { get; set; } = "month-start"; // "month-start" or "month-10th"
    public DateTime? SelectedMonth { get; set; } // null = current month
    public bool ShowHalves { get; set; } = false; // Show halves column and summary card
}

