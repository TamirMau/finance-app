using System.Text.RegularExpressions;

namespace FinanceApi.Helpers;

/// <summary>
/// Shared helper class for extracting card numbers from file names
/// Used by both server-side parsers and client-side code to avoid duplication
/// </summary>
public static class CardNumberExtractor
{
    /// <summary>
    /// Extract card number (last 4 digits) from file name
    /// Supports multiple patterns:
    /// - "מסתיים ב-2753" or "ב-2753" (ends with)
    /// - "8354_12_2025" or "4324-max" (4 digits at start)
    /// - "כרטיס מאסטרקארד 2753" (after card type)
    /// - Any 4-digit number in filename (last resort)
    /// </summary>
    public static string? ExtractCardNumberFromFileName(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return null;
        }

        // Pattern 1: "מסתיים ב-2753" or "ב-2753" (ends with)
        var hebrewEndsWithMatch = Regex.Match(fileName, @"[מב]\s*-?\s*(\d{4})");
        if (hebrewEndsWithMatch.Success)
        {
            return hebrewEndsWithMatch.Groups[1].Value;
        }

        // Pattern 2: "8354_12_2025" or "4324-max" - 4 digits at start or before dash/underscore
        var prefixMatch = Regex.Match(fileName, @"^(\d{4})[_-]");
        if (prefixMatch.Success)
        {
            return prefixMatch.Groups[1].Value;
        }

        // Pattern 3: "כרטיס מאסטרקארד 2753" - after card type
        var afterCardTypeMatch = Regex.Match(fileName, @"(?:כרטיס|מאסטרקארד|ויזה|אמריקן)\s+(\d{4})");
        if (afterCardTypeMatch.Success)
        {
            return afterCardTypeMatch.Groups[1].Value;
        }

        // Pattern 4: Any 4-digit number in filename (last resort)
        var any4Digits = Regex.Match(fileName, @"\b(\d{4})\b");
        if (any4Digits.Success)
        {
            return any4Digits.Groups[1].Value;
        }

        return null;
    }

    /// <summary>
    /// Extract last 4 digits from a card number string
    /// </summary>
    public static string? ExtractLast4Digits(string? cardNumber)
    {
        if (string.IsNullOrWhiteSpace(cardNumber))
        {
            return null;
        }

        // Extract only digits
        var digits = Regex.Replace(cardNumber, @"\D", "");
        
        if (digits.Length >= 4)
        {
            return digits.Substring(digits.Length - 4);
        }

        return digits.Length > 0 ? digits : null;
    }
}

