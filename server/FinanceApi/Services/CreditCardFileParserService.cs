using FinanceApi.Models.DTOs;
using FinanceApi.Helpers;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using OfficeOpenXml;

namespace FinanceApi.Services;

public class CreditCardFileParserService : ICreditCardFileParserService
{
    private readonly ILogger<CreditCardFileParserService> _logger;

    public CreditCardFileParserService(ILogger<CreditCardFileParserService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Parses a credit card file and extracts transaction data.
    /// </summary>
    /// <param name="fileStream">The file stream to parse</param>
    /// <param name="fileName">The name of the file (used to extract card number)</param>
    /// <param name="userId">The user ID (required by interface, may be used for future logging/filtering)</param>
    /// <returns>List of parsed transaction DTOs</returns>
    public async Task<List<TransactionDto>> ParseFileAsync(Stream fileStream, string fileName, int userId)
    {
        fileStream.Position = 0;

        // Extract card number (last 4 digits) from file name
        var cardNumberFromFileName = ExtractCardNumberFromFileName(fileName);

        // Determine file type by extension
        var fileExtension = Path.GetExtension(fileName).ToLowerInvariant();
        
        if (fileExtension == ".xlsx" || fileExtension == ".xls")
        {
            // Parse Excel file
            return await ParseExcelFileAsync(fileStream, cardNumberFromFileName);
        }
        else
        {
            // Parse CSV file
            return await ParseGenericCsvFileAsync(fileStream, cardNumberFromFileName);
        }
    }

    /// <summary>
    /// Extracts month and year from a file stream.
    /// Checks multiple formats and locations.
    /// </summary>
    public (int Year, int Month)? ExtractMonthYearFromFile(Stream fileStream, string fileName)
    {
        fileStream.Position = 0;
        
        var fileExtension = Path.GetExtension(fileName).ToLowerInvariant();
        
        if (fileExtension == ".xlsx" || fileExtension == ".xls")
        {
            return ExtractMonthYearFromExcel(fileStream, fileName);
        }
        else
        {
            return ExtractMonthYearFromCsv(fileStream);
        }
    }

    private string? ExtractCardNumberFromFileName(string fileName)
    {
        return CardNumberExtractor.ExtractCardNumberFromFileName(fileName);
    }

    private async Task<List<TransactionDto>> ParseGenericCsvFileAsync(Stream fileStream, string? cardNumberFromFileName = null)
    {
        var transactions = new List<TransactionDto>();
        using var reader = new StreamReader(fileStream, Encoding.UTF8);
        
        var lines = new List<string>();
        string? line;
        while ((line = await reader.ReadLineAsync()) != null)
        {
            lines.Add(line);
        }

        if (lines.Count < 2) return transactions;

        // Find header row
        var headerIndex = -1;
        for (int i = 0; i < lines.Count; i++)
        {
            if (lines[i].Contains("תאריך עסקה") || lines[i].Contains("תאריך חיוב"))
            {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex == -1) return transactions;

        var headers = ParseCsvLine(lines[headerIndex]);
        var headerMap = CreateHeaderMap(headers, new[]
        {
            ("תאריך עסקה", "TransactionDate"),
            ("תאריך חיוב", "BillingDate"),
            ("סכום", "Amount"),
            ("בית עסק", "MerchantName"),
            ("מספר כרטיס", "CardNumber"),
            ("אסמכתא", "ReferenceNumber"),
            ("ענף", "Branch"),
            ("מטבע", "Currency"),
            ("מחציות", "IsHalves")
        });

        // Parse data rows
        for (int i = headerIndex + 1; i < lines.Count; i++)
        {
            if (string.IsNullOrWhiteSpace(lines[i])) continue;

            var values = ParseCsvLine(lines[i]);
            if (values.Count < 3) continue; // Skip invalid rows

            try
            {
                var transactionDateStr = GetValue(values, headerMap, "TransactionDate");
                var billingDateStr = GetValue(values, headerMap, "BillingDate");
                
                var transactionDate = ParseDate(transactionDateStr);
                // If BillingDate is not found in the file, use TransactionDate
                var billingDate = string.IsNullOrWhiteSpace(billingDateStr) 
                    ? transactionDate 
                    : ParseDate(billingDateStr);
                
                // Get card number - prefer from row data, fallback to file name
                var cardNumberFromRow = ExtractLast4Digits(GetValue(values, headerMap, "CardNumber"));
                var cardNumber = cardNumberFromRow ?? cardNumberFromFileName;

                // Parse IsHalves from CSV (if column exists), default to false
                var isHalvesStr = GetValue(values, headerMap, "IsHalves");
                var isHalves = false;
                if (!string.IsNullOrWhiteSpace(isHalvesStr))
                {
                    bool.TryParse(isHalvesStr, out isHalves);
                }

                var transaction = new TransactionDto
                {
                    TransactionDate = transactionDate,
                    BillingDate = billingDate,
                    Amount = Math.Abs(ParseDecimal(GetValue(values, headerMap, "Amount"))),
                    Type = ParseDecimal(GetValue(values, headerMap, "Amount")) < 0 ? "Income" : "Expense",
                    MerchantName = GetValue(values, headerMap, "MerchantName") ?? string.Empty,
                    CardNumber = cardNumber,
                    ReferenceNumber = GetValue(values, headerMap, "ReferenceNumber"),
                    Currency = GetValue(values, headerMap, "Currency") ?? "ILS",
                    Branch = GetValue(values, headerMap, "Branch"),
                    Source = "Excel Import",
                    CategoryId = 1, // Will be set later based on Branch
                    IsHalves = isHalves // Default to false if not provided
                };

                transactions.Add(transaction);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse row {RowNumber}: {Row}", i, lines[i]);
            }
        }

        return transactions;
    }


    private List<string> ParseCsvLine(string line)
    {
        var values = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;

        foreach (var ch in line)
        {
            if (ch == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (ch == ',' && !inQuotes)
            {
                values.Add(current.ToString().Trim());
                current.Clear();
            }
            else
            {
                current.Append(ch);
            }
        }
        values.Add(current.ToString().Trim());

        return values;
    }

    private Dictionary<string, int> CreateHeaderMap(List<string> headers, (string Hebrew, string English)[] mappings)
    {
        var map = new Dictionary<string, int>();
        
        for (int i = 0; i < headers.Count; i++)
        {
            var header = headers[i].Trim();
            foreach (var (hebrew, english) in mappings)
            {
                if (header.Contains(hebrew, StringComparison.OrdinalIgnoreCase))
                {
                    map[english] = i;
                    break;
                }
            }
        }

        return map;
    }

    private string? GetValue(List<string> values, Dictionary<string, int> headerMap, string key)
    {
        if (headerMap.TryGetValue(key, out var index) && index < values.Count)
        {
            var value = values[index].Trim();
            return string.IsNullOrWhiteSpace(value) ? null : value;
        }
        return null;
    }

    private DateTime ParseDate(string? dateStr)
    {
        return ExcelParsingHelper.ParseDate(dateStr);
    }

    private decimal ParseDecimal(string? value)
    {
        return ExcelParsingHelper.ParseDecimalWithDefault(value);
    }

    private string? ExtractLast4Digits(string? cardNumber)
    {
        return CardNumberExtractor.ExtractLast4Digits(cardNumber);
    }

    /// <summary>
    /// Parse Excel file (XLSX/XLS) and extract transactions
    /// </summary>
    private Task<List<TransactionDto>> ParseExcelFileAsync(Stream fileStream, string? cardNumberFromFileName = null)
    {
        // For Excel files, parsing is done on client side
        // This method is a placeholder - actual Excel parsing happens client-side
        // Server receives JSON from client
        return Task.FromResult(new List<TransactionDto>());
    }

    /// <summary>
    /// Extract month and year from Excel file
    /// Supports formats:
    /// 1. A3 = "עסקאות לחיוב ב-10/11/2025: 10,382.64 ₪" -> extract "11/2025"
    /// 2. C2 = "דצמבר 2025" -> convert to month/year
    /// 3. A3 = "12/2025" -> use as is
    /// </summary>
    private (int Year, int Month)? ExtractMonthYearFromExcel(Stream fileStream, string fileName)
    {
        fileStream.Position = 0;
        
        try
        {
            // Set EPPlus license context
            ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;
            
            using var package = new ExcelPackage(fileStream);
            if (package.Workbook.Worksheets.Count == 0)
            {
                return null;
            }

            var worksheet = package.Workbook.Worksheets[0];

            // Try A3 first (format 1 and 3)
            var a3Value = worksheet.Cells["A3"]?.Value?.ToString() ?? string.Empty;
            if (!string.IsNullOrWhiteSpace(a3Value))
            {
                var result = ParseMonthYearFromA3(a3Value);
                if (result.HasValue)
                {
                    return result;
                }
            }

            // Try C2 (format 2)
            var c2Value = worksheet.Cells["C2"]?.Value?.ToString() ?? string.Empty;
            if (!string.IsNullOrWhiteSpace(c2Value))
            {
                var result = ParseMonthYearFromC2(c2Value);
                if (result.HasValue)
                {
                    return result;
                }
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to extract month/year from Excel file {FileName}", fileName);
            return null;
        }
    }

    /// <summary>
    /// Extract month and year from CSV file
    /// Looks for date patterns in the first few lines
    /// </summary>
    private (int Year, int Month)? ExtractMonthYearFromCsv(Stream fileStream)
    {
        fileStream.Position = 0;
        
        using var reader = new StreamReader(fileStream, Encoding.UTF8);
        
        // Read first 10 lines to look for date patterns
        for (int i = 0; i < 10; i++)
        {
            var line = reader.ReadLine();
            if (line == null) break;

            // Try to parse month/year from line
            var result = ParseMonthYearFromA3(line);
            if (result.HasValue)
            {
                return result;
            }
        }

        return null;
    }

    /// <summary>
    /// Parse month/year from A3 cell format
    /// Formats:
    /// 1. "עסקאות לחיוב ב-10/11/2025: 10,382.64 ₪" -> extract "11/2025"
    /// 2. "12/2025" -> use as is
    /// </summary>
    private (int Year, int Month)? ParseMonthYearFromA3(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        // Format 1: Extract from "עסקאות לחיוב ב-10/11/2025: ..."
        // Pattern: look for DD/MM/YYYY or MM/YYYY
        var pattern1 = new Regex(@"(\d{1,2})/(\d{1,2})/(\d{4})");
        var match1 = pattern1.Match(value);
        if (match1.Success)
        {
            var day = int.Parse(match1.Groups[1].Value);
            var month = int.Parse(match1.Groups[2].Value);
            var year = int.Parse(match1.Groups[3].Value);
            
            if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100)
            {
                return (year, month);
            }
        }

        // Format 2: "MM/YYYY" or "M/YYYY"
        var pattern2 = new Regex(@"^(\d{1,2})/(\d{4})$");
        var match2 = pattern2.Match(value.Trim());
        if (match2.Success)
        {
            var month = int.Parse(match2.Groups[1].Value);
            var year = int.Parse(match2.Groups[2].Value);
            
            if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100)
            {
                return (year, month);
            }
        }

        // Format 3: Look for MM/YYYY anywhere in the string
        var pattern3 = new Regex(@"(\d{1,2})/(\d{4})");
        var match3 = pattern3.Match(value);
        if (match3.Success)
        {
            var month = int.Parse(match3.Groups[1].Value);
            var year = int.Parse(match3.Groups[2].Value);
            
            if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100)
            {
                return (year, month);
            }
        }

        return null;
    }

    /// <summary>
    /// Parse month/year from C2 cell format
    /// Format: "דצמבר 2025" -> convert to month/year
    /// </summary>
    private (int Year, int Month)? ParseMonthYearFromC2(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();

        // Hebrew month names mapping
        var hebrewMonths = new Dictionary<string, int>
        {
            { "ינואר", 1 },
            { "פברואר", 2 },
            { "מרץ", 3 },
            { "מרס", 3 },
            { "אפריל", 4 },
            { "מאי", 5 },
            { "יוני", 6 },
            { "יולי", 7 },
            { "אוגוסט", 8 },
            { "ספטמבר", 9 },
            { "אוקטובר", 10 },
            { "נובמבר", 11 },
            { "דצמבר", 12 }
        };

        // Try to find Hebrew month name
        foreach (var kvp in hebrewMonths)
        {
            if (trimmed.Contains(kvp.Key))
            {
                // Extract year (4 digits)
                var yearPattern = new Regex(@"(\d{4})");
                var yearMatch = yearPattern.Match(trimmed);
                if (yearMatch.Success)
                {
                    var year = int.Parse(yearMatch.Groups[1].Value);
                    if (year >= 2000 && year <= 2100)
                    {
                        return (year, kvp.Value);
                    }
                }
            }
        }

        return null;
    }
}

