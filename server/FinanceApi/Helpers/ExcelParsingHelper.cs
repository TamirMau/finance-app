using System.Globalization;

namespace FinanceApi.Helpers;

/// <summary>
/// Shared helper class for parsing Excel data (dates and decimals)
/// Used by both BankStatementParserService and CreditCardFileParserService to avoid code duplication
/// </summary>
public static class ExcelParsingHelper
{
    /// <summary>
    /// Parse a date value from Excel (handles DateTime, double serial numbers, and string formats)
    /// </summary>
    public static DateTime ParseDate(object? dateValue)
    {
        if (dateValue == null || dateValue == DBNull.Value)
        {
            return DateTime.Now;
        }

        // If it's already a DateTime
        if (dateValue is DateTime dateTime)
        {
            return dateTime;
        }

        // If it's a double (Excel date serial number)
        if (dateValue is double excelDate)
        {
            return DateTime.FromOADate(excelDate);
        }

        // Try parsing as string
        var dateStr = dateValue.ToString() ?? string.Empty;
        
        // Try common Hebrew date formats
        var formats = new[]
        {
            "dd/MM/yyyy",
            "dd-MM-yyyy",
            "yyyy-MM-dd",
            "dd.MM.yyyy",
            "d/M/yyyy",
            "d-M-yyyy"
        };

        foreach (var format in formats)
        {
            if (DateTime.TryParseExact(dateStr, format, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                return date;
            }
        }

        // Fallback to standard parsing
        if (DateTime.TryParse(dateStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDate))
        {
            return parsedDate;
        }

        return DateTime.Now;
    }

    /// <summary>
    /// Parse a decimal value from Excel (removes currency symbols and spaces)
    /// </summary>
    public static decimal? ParseDecimal(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        // Remove currency symbols and spaces
        value = value.Replace("₪", "")
                    .Replace("$", "")
                    .Replace("€", "")
                    .Replace(" ", "")
                    .Replace(",", "");

        if (decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var result))
        {
            return result;
        }

        return null;
    }

    /// <summary>
    /// Parse a decimal value with fallback to 0 (non-nullable version)
    /// </summary>
    public static decimal ParseDecimalWithDefault(string? value)
    {
        return ParseDecimal(value) ?? 0;
    }
}

