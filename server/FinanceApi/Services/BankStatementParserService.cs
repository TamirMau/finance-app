using FinanceApi.Models.DTOs;
using FinanceApi.Helpers;
using OfficeOpenXml;
using ExcelDataReader;
using System.Data;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace FinanceApi.Services;

public class BankStatementParserService : IBankStatementParserService
{
    private readonly ILogger<BankStatementParserService> _logger;

    static BankStatementParserService()
    {
        // Set EPPlus license context (required for non-commercial use)
        // This must be set before any ExcelPackage operations
        ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;
        
        // Register encoding provider for ExcelDataReader (needed for .xls files)
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
    }

    public BankStatementParserService(ILogger<BankStatementParserService> logger)
    {
        _logger = logger;
    }

    public Task<BankStatementDto> ParseFileAsync(Stream fileStream, string fileName)
    {
        try
        {
            fileStream.Position = 0;
            
            // Validate file is not empty
            if (fileStream.Length == 0)
            {
                throw new InvalidOperationException("The uploaded file is empty.");
            }
            
            // Determine file format by extension
            var fileExtension = Path.GetExtension(fileName).ToLowerInvariant();
            bool isXlsFormat = fileExtension == ".xls";
            
            if (isXlsFormat)
            {
                // Use ExcelDataReader for .xls files
                return Task.FromResult(ParseXlsFile(fileStream, fileName));
            }
            else
            {
                // Use EPPlus for .xlsx files
                return Task.FromResult(ParseXlsxFile(fileStream, fileName));
            }
        }
        catch (InvalidDataException)
        {
            // Re-throw InvalidDataException as-is (already has proper message)
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in ParseFileAsync for file {FileName}: {Message}", fileName, ex.Message);
            throw;
        }
    }

    private BankStatementDto ParseXlsxFile(Stream fileStream, string fileName)
    {
        fileStream.Position = 0;
        
        ExcelPackage package;
        try
        {
            package = new ExcelPackage(fileStream);
        }
        catch (Exception ex) when (ex.Message.Contains("not a valid Package file") || ex.Message.Contains("encrypted") || ex.Message.Contains("Invalid"))
        {
            _logger.LogError(ex, "Failed to open Excel package. File might be encrypted or corrupted.");
            throw new InvalidDataException("The file is not a valid Excel file or is encrypted. Please ensure the file is not password-protected.", ex);
        }
        
        using (package)
        {
            if (package.Workbook.Worksheets.Count == 0)
            {
                throw new InvalidOperationException("Excel file does not contain any worksheets");
            }
            
            var worksheet = package.Workbook.Worksheets[0];
            
            // Detect format (format3, format2/new, or format1/old)
            int formatType = DetectFormat(worksheet);
            
            string accountNumber;
            DateTime statementDate;
            decimal? balance = null;
            int headerRow;
            Dictionary<string, int> columnMap;
            
            if (formatType == 3)
            {
                // Format 3: Extract from A4 - "מספר חשבון  12-640-361645  תאריך הפקה  16.12.2025"
                var a4Value = worksheet.Cells["A4"]?.Value?.ToString() ?? string.Empty;
                (accountNumber, statementDate) = ExtractAccountInfoFormat3(a4Value);
                
                // Extract balance from G6 (column 7) in format 3
                var g6Value = worksheet.Cells["G6"]?.Value;
                if (g6Value != null)
                {
                    balance = ParseDecimal(g6Value.ToString());
                    _logger.LogInformation("Extracted balance from G6 in format 3: {Balance}", balance);
                }
                else
                {
                    _logger.LogWarning("Could not extract balance from G6 in format 3. Cell G6 is empty or null.");
                }
                
                // In format 3, header row is usually row 3
                headerRow = FindHeaderRowXlsx(worksheet, formatType: 3);
                if (headerRow == -1)
                {
                    throw new InvalidOperationException("Could not find header row in Excel file. Please ensure the file contains columns: יתרה, תאריך ערך, חובה, זכות, אסמכתא, פרטים, הפעולה, תאריך");
                }
                
                // Map column indices
                columnMap = MapColumnsXlsx(worksheet, headerRow, formatType: 3);
            }
            else
            {
                // Format 1 (old): Extract from A3
                var a3Value = worksheet.Cells["A3"]?.Value?.ToString() ?? string.Empty;
                (accountNumber, statementDate) = ExtractAccountInfo(a3Value, isNewFormat: false);
                
                // Extract balance from I6 (column 9) in format 1
                var i6Value = worksheet.Cells["I6"]?.Value;
                if (i6Value != null)
                {
                    balance = ParseDecimal(i6Value.ToString());
                    _logger.LogInformation("Extracted balance from I6 in format 1: {Balance}", balance);
                }
                else
                {
                    _logger.LogWarning("Could not extract balance from I6 in format 1");
                }
                
                // Find header row (usually row 4 or 5)
                headerRow = FindHeaderRowXlsx(worksheet, formatType: 1);
                if (headerRow == -1)
                {
                    throw new InvalidOperationException("Could not find header row in Excel file. Please ensure the file contains columns: יתרה, תאריך ערך, חובה, זכות, אסמכתא, תיאור, סוג פעולה, תאריך");
                }

                // Map column indices
                columnMap = MapColumnsXlsx(worksheet, headerRow, formatType: 1);
            }

            // Parse data rows
            var rows = new List<BankStatementRowDto>();
            var lastRow = worksheet.Dimension?.End.Row ?? headerRow + 1;
            
            for (int row = headerRow + 1; row <= lastRow; row++)
            {
                try
                {
                    var rowData = ParseRowXlsx(worksheet, row, columnMap);
                    if (rowData != null)
                    {
                        rows.Add(rowData);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to parse row {RowNumber}, skipping", row);
                }
            }

            return new BankStatementDto
            {
                AccountNumber = accountNumber,
                StatementDate = statementDate,
                Balance = balance,
                Rows = rows
            };
        }
    }

    private BankStatementDto ParseXlsFile(Stream fileStream, string fileName)
    {
        try
        {
            fileStream.Position = 0;
            
            IExcelDataReader reader;
            try
            {
                reader = ExcelReaderFactory.CreateReader(fileStream);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create Excel reader for .xls file");
                throw new InvalidDataException("Failed to read Excel file. The file might be corrupted or in an unsupported format.", ex);
            }
            
            using (reader)
            {
                DataSet dataSet;
                try
                {
                    dataSet = reader.AsDataSet(new ExcelDataSetConfiguration
                    {
                        ConfigureDataTable = _ => new ExcelDataTableConfiguration
                        {
                            UseHeaderRow = false
                        }
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to read Excel data set");
                    throw new InvalidDataException("Failed to read Excel data. The file might be corrupted.", ex);
                }
                
                if (dataSet == null || dataSet.Tables.Count == 0)
                {
                    throw new InvalidOperationException("Excel file does not contain any worksheets");
                }
                
                var dataTable = dataSet.Tables[0];
                
                // Detect format (format3, format2/new, or format1/old)
                int formatType = DetectFormatXls(dataTable);
                
                string accountNumber;
                DateTime statementDate;
                decimal? balance = null;
                int headerRow;
                Dictionary<string, int> columnMap;
                
                if (formatType == 3)
                {
                    // Format 3: Extract from A4 (row index 3, column index 0)
                    string a4Value = string.Empty;
                    if (dataTable.Rows.Count > 3 && dataTable.Columns.Count > 0)
                    {
                        a4Value = dataTable.Rows[3][0]?.ToString() ?? string.Empty;
                    }
                    
                    (accountNumber, statementDate) = ExtractAccountInfoFormat3(a4Value);
                    
                    // Extract balance from G6 (row index 5, column index 6) in format 3
                    if (dataTable.Rows.Count > 5 && dataTable.Columns.Count > 6)
                    {
                        var g6Value = dataTable.Rows[5][6];
                        if (g6Value != null && g6Value != DBNull.Value)
                        {
                            balance = ParseDecimal(g6Value.ToString());
                            _logger.LogInformation("Extracted balance from G6 (row 5, col 6) in format 3: {Balance}", balance);
                        }
                        else
                        {
                            _logger.LogWarning("Could not extract balance from G6 (row 5, col 6) in format 3. Cell is empty or null.");
                        }
                    }
                    else
                    {
                        _logger.LogWarning("Cannot access G6 in format 3: Rows count: {RowCount}, Columns count: {ColCount}", 
                            dataTable.Rows.Count, dataTable.Columns.Count);
                    }
                    
                    // In format 3, header row is usually row 3 (row index 2)
                    headerRow = FindHeaderRowXls(dataTable, formatType: 3);
                    if (headerRow == -1)
                    {
                        throw new InvalidOperationException("Could not find header row in Excel file. Please ensure the file contains columns: יתרה, תאריך ערך, חובה, זכות, אסמכתא, פרטים, הפעולה, תאריך");
                    }
                    
                    // Map column indices
                    columnMap = MapColumnsXls(dataTable, headerRow, formatType: 3);
                }
                else
                {
                    // Format 1 (old): Extract from A3 (row index 2, column index 0)
                    string a3Value = string.Empty;
                    if (dataTable.Rows.Count > 2 && dataTable.Columns.Count > 0)
                    {
                        a3Value = dataTable.Rows[2][0]?.ToString() ?? string.Empty;
                    }
                    
                    (accountNumber, statementDate) = ExtractAccountInfo(a3Value, isNewFormat: false);
                    
                    // Extract balance from I6 (row index 5, column index 8) in format 1
                    if (dataTable.Rows.Count > 5 && dataTable.Columns.Count > 8)
                    {
                        var i6Value = dataTable.Rows[5][8];
                        if (i6Value != null && i6Value != DBNull.Value)
                        {
                            balance = ParseDecimal(i6Value.ToString());
                            _logger.LogInformation("Extracted balance from I6 (row 5, col 8) in format 1: {Balance}", balance);
                        }
                        else
                        {
                            _logger.LogWarning("Could not extract balance from I6 (row 5, col 8) in format 1");
                        }
                    }
                    
                    // Find header row
                    headerRow = FindHeaderRowXls(dataTable, formatType: 1);
                    if (headerRow == -1)
                    {
                        throw new InvalidOperationException("Could not find header row in Excel file. Please ensure the file contains columns: יתרה, תאריך ערך, חובה, זכות, אסמכתא, תיאור, סוג פעולה, תאריך");
                    }
                    
                    // Map column indices
                    columnMap = MapColumnsXls(dataTable, headerRow, formatType: 1);
                }

                // Parse data rows
                var rows = new List<BankStatementRowDto>();
                
                for (int row = headerRow + 1; row < dataTable.Rows.Count; row++)
                {
                    try
                    {
                        var rowData = ParseRowXls(dataTable, row, columnMap);
                        if (rowData != null)
                        {
                            rows.Add(rowData);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to parse row {RowNumber}, skipping", row);
                    }
                }

                return new BankStatementDto
                {
                    AccountNumber = accountNumber,
                    StatementDate = statementDate,
                    Balance = balance,
                    Rows = rows
                };
            }
        }
        catch (InvalidDataException)
        {
            // Re-throw InvalidDataException as-is
            throw;
        }
        catch (InvalidOperationException)
        {
            // Re-throw InvalidOperationException as-is
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing .xls file: {FileName}", fileName);
            throw new InvalidOperationException($"Error parsing Excel file: {ex.Message}", ex);
        }
    }

    private (string AccountNumber, DateTime StatementDate) ExtractAccountInfo(string cellValue, bool isNewFormat = false)
    {
        var accountNumber = string.Empty;
        var statementDate = DateTime.Now;

        if (isNewFormat)
        {
            // New format: "מספר חשבון 12-640-361645 תאריך הפקה 16.12.2025"
            // Extract account number - get the last part after the last dash
            var accountMatch = Regex.Match(cellValue, @"מספר\s*חשבון\s*[\d-]+\s*(\d+)");
            if (accountMatch.Success)
            {
                accountNumber = accountMatch.Groups[1].Value.Trim();
            }
            else
            {
                // Fallback: try to extract full account number pattern
                accountMatch = Regex.Match(cellValue, @"מספר\s*חשבון\s*([\d-]+)");
                if (accountMatch.Success)
                {
                    var fullAccount = accountMatch.Groups[1].Value.Trim();
                    // Extract last part (after last dash)
                    var parts = fullAccount.Split('-');
                    if (parts.Length > 0)
                    {
                        accountNumber = parts[parts.Length - 1];
                    }
                }
            }

            // Extract date (pattern: "תאריך הפקה DD.MM.YYYY")
            var dateMatch = Regex.Match(cellValue, @"תאריך\s*הפקה\s*(\d{1,2}\.\d{1,2}\.\d{4})");
            if (dateMatch.Success)
            {
                var dateStr = dateMatch.Groups[1].Value.Trim();
                if (DateTime.TryParseExact(dateStr, "dd.MM.yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDate))
                {
                    statementDate = parsedDate;
                }
            }
        }
        else
        {
            // Old format: "חשבון: 036-606197 תאריך:11/12/2025 17:02"
            // Extract account number (pattern: "חשבון: XXX-XXXXXX")
            var accountMatch = Regex.Match(cellValue, @"חשבון:\s*([\d-]+)");
            if (accountMatch.Success)
            {
                accountNumber = accountMatch.Groups[1].Value.Trim();
            }

            // Extract date (pattern: "תאריך:DD/MM/YYYY")
            var dateMatch = Regex.Match(cellValue, @"תאריך:\s*(\d{1,2}/\d{1,2}/\d{4})");
            if (dateMatch.Success)
            {
                var dateStr = dateMatch.Groups[1].Value.Trim();
                if (DateTime.TryParseExact(dateStr, "dd/MM/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDate))
                {
                    statementDate = parsedDate;
                }
            }
        }

        return (accountNumber, statementDate);
    }

    /// <summary>
    /// Extracts account number and statement date from A4 cell in format 3:
    /// "מספר חשבון  12-640-361645  תאריך הפקה  16.12.2025"
    /// Returns only the last part of account number (e.g., "361645")
    /// </summary>
    private (string AccountNumber, DateTime StatementDate) ExtractAccountInfoFormat3(string cellValue)
    {
        string accountNumber = string.Empty;
        DateTime statementDate = DateTime.Now;

        if (string.IsNullOrWhiteSpace(cellValue))
        {
            return (accountNumber, statementDate);
        }

        // Extract account number - get the last part after the last dash
        // Pattern: "מספר חשבון  12-640-361645" -> extract "361645"
        var accountMatch = Regex.Match(cellValue, @"מספר\s*חשבון\s*[\d-]+\s*(\d+)");
        if (accountMatch.Success)
        {
            accountNumber = accountMatch.Groups[1].Value.Trim();
        }
        else
        {
            // Fallback: try to extract full account number pattern and get last part
            accountMatch = Regex.Match(cellValue, @"מספר\s*חשבון\s*([\d-]+)");
            if (accountMatch.Success)
            {
                var fullAccount = accountMatch.Groups[1].Value.Trim();
                // Extract last part (after last dash)
                var parts = fullAccount.Split('-');
                if (parts.Length > 0)
                {
                    accountNumber = parts[parts.Length - 1];
                }
            }
        }

        // Extract date (pattern: "תאריך הפקה DD.MM.YYYY")
        var dateMatch = Regex.Match(cellValue, @"תאריך\s*הפקה\s*(\d{1,2}\.\d{1,2}\.\d{4})");
        if (dateMatch.Success)
        {
            var dateStr = dateMatch.Groups[1].Value.Trim();
            if (DateTime.TryParseExact(dateStr, "dd.MM.yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDate))
            {
                statementDate = parsedDate;
            }
        }

        return (accountNumber, statementDate);
    }

    /// <summary>
    /// Detects the format type:
    /// 3 = Format 3 (A4): "מספר חשבון  12-640-361645  תאריך הפקה  16.12.2025"
    /// 1 = Format 1 (A3): "חשבון: ... תאריך: ..."
    /// </summary>
    private int DetectFormat(ExcelWorksheet worksheet)
    {
        // Check A4 for format 3
        var a4Value = worksheet.Cells["A4"]?.Value?.ToString() ?? string.Empty;
        if (a4Value.Contains("מספר חשבון") && a4Value.Contains("תאריך הפקה"))
        {
            _logger.LogInformation("Detected Format 3: Found account info in A4");
            return 3;
        }
        
        // Default to format 1 (old format)
        _logger.LogInformation("Detected Format 1: Using default (old format with A3)");
        return 1;
    }

    private bool IsNewFormat(ExcelWorksheet worksheet)
    {
        // Check A2 for new format pattern
        var a2Value = worksheet.Cells["A2"]?.Value?.ToString() ?? string.Empty;
        return a2Value.Contains("מספר חשבון") && a2Value.Contains("תאריך הפקה");
    }

    private bool IsNewFormatXls(DataTable dataTable)
    {
        // Check A2 (row index 1, column index 0) for new format pattern
        if (dataTable.Rows.Count > 1 && dataTable.Columns.Count > 0)
        {
            var a2Value = dataTable.Rows[1][0]?.ToString() ?? string.Empty;
            return a2Value.Contains("מספר חשבון") && a2Value.Contains("תאריך הפקה");
        }
        return false;
    }

    /// <summary>
    /// Detects the format type for .xls files:
    /// 3 = Format 3 (A4): "מספר חשבון  12-640-361645  תאריך הפקה  16.12.2025"
    /// 1 = Format 1 (A3): "חשבון: ... תאריך: ..."
    /// </summary>
    private int DetectFormatXls(DataTable dataTable)
    {
        // Check A4 (row index 3, column index 0) for format 3
        if (dataTable.Rows.Count > 3 && dataTable.Columns.Count > 0)
        {
            var a4Value = dataTable.Rows[3][0]?.ToString() ?? string.Empty;
            if (a4Value.Contains("מספר חשבון") && a4Value.Contains("תאריך הפקה"))
            {
                _logger.LogInformation("Detected Format 3 (XLS): Found account info in A4 (row 3)");
                return 3;
            }
        }
        
        // Default to format 1 (old format)
        _logger.LogInformation("Detected Format 1 (XLS): Using default (old format with A3)");
        return 1;
    }

    // XLSX methods
    private int FindHeaderRowXlsx(ExcelWorksheet worksheet, int formatType = 1)
    {
        if (formatType == 3)
        {
            // In format 3, header row is usually row 3
            // But verify it contains the expected headers
            var row3Text = string.Empty;
            var lastCol = Math.Min(worksheet.Dimension?.End.Column ?? 10, 10);
            for (int col = 1; col <= lastCol; col++)
            {
                var cellValue = worksheet.Cells[3, col]?.Value?.ToString() ?? string.Empty;
                row3Text += cellValue + " ";
            }
            
            if (row3Text.Contains("יתרה") || row3Text.Contains("תאריך") || row3Text.Contains("חובה") || row3Text.Contains("זכות"))
            {
                return 3;
            }
        }
        
        // Look for header row containing "יתרה" or "תאריך ערך"
        var lastRow = worksheet.Dimension?.End.Row ?? 10;
        var startRow = formatType == 3 ? 3 : 1;
        
        for (int row = startRow; row <= Math.Min(lastRow, 10); row++)
        {
            var rowText = string.Empty;
            for (int col = 1; col <= Math.Min(worksheet.Dimension?.End.Column ?? 10, 10); col++)
            {
                var cellValue = worksheet.Cells[row, col]?.Value?.ToString() ?? string.Empty;
                rowText += cellValue + " ";
            }

            if (rowText.Contains("יתרה") || rowText.Contains("תאריך ערך"))
            {
                return row;
            }
        }

        return -1;
    }

    private Dictionary<string, int> MapColumnsXlsx(ExcelWorksheet worksheet, int headerRow, int formatType = 1)
    {
        var map = new Dictionary<string, int>();
        var lastCol = worksheet.Dimension?.End.Column ?? 10;

        for (int col = 1; col <= lastCol; col++)
        {
            var headerValue = worksheet.Cells[headerRow, col]?.Value?.ToString() ?? string.Empty;
            headerValue = headerValue.Trim();

            if (headerValue.Contains("יתרה"))
            {
                map["Balance"] = col;
            }
            else if (headerValue.Contains("תאריך ערך"))
            {
                map["ValueDate"] = col;
            }
            else if (headerValue.Contains("חובה"))
            {
                map["Debit"] = col;
            }
            else if (headerValue.Contains("זכות"))
            {
                map["Credit"] = col;
            }
            else if (headerValue.Contains("אסמכתא"))
            {
                map["Reference"] = col;
            }
            else if (headerValue.Contains("תיאור") || headerValue.Contains("פרטים"))
            {
                // Support both "תיאור" (old) and "פרטים" (new)
                map["Description"] = col;
            }
            else if (headerValue.Contains("סוג פעולה") || headerValue.Contains("הפעולה"))
            {
                // Support both "סוג פעולה" (old) and "הפעולה" (new)
                map["ActionType"] = col;
            }
            else if (headerValue.Contains("תאריך") && !headerValue.Contains("ערך"))
            {
                map["Date"] = col;
            }
            else if (headerValue.Contains("לטובת"))
            {
                map["ForBenefitOf"] = col;
            }
            else if (headerValue.Contains("עבור"))
            {
                map["For"] = col;
            }
        }

        return map;
    }

    private BankStatementRowDto? ParseRowXlsx(ExcelWorksheet worksheet, int row, Dictionary<string, int> columnMap)
    {
        try
        {
            var rowDto = new BankStatementRowDto();

            // Parse Balance (יתרה) - optional
            if (columnMap.TryGetValue("Balance", out var balanceCol))
            {
                var balanceValue = worksheet.Cells[row, balanceCol]?.Value;
                if (balanceValue != null)
                {
                    rowDto.Balance = ParseDecimal(balanceValue.ToString());
                }
            }

            // Parse ValueDate (תאריך ערך) - required
            if (columnMap.TryGetValue("ValueDate", out var valueDateCol))
            {
                var valueDateValue = worksheet.Cells[row, valueDateCol]?.Value;
                if (valueDateValue != null)
                {
                    rowDto.ValueDate = ParseDate(valueDateValue);
                }
                else
                {
                    return null; // Skip rows without value date
                }
            }
            else
            {
                return null; // Skip rows without value date column
            }

            // Parse Debit (חובה) - optional
            if (columnMap.TryGetValue("Debit", out var debitCol))
            {
                var debitValue = worksheet.Cells[row, debitCol]?.Value;
                if (debitValue != null)
                {
                    rowDto.Debit = ParseDecimal(debitValue.ToString());
                }
            }

            // Parse Credit (זכות) - optional
            if (columnMap.TryGetValue("Credit", out var creditCol))
            {
                var creditValue = worksheet.Cells[row, creditCol]?.Value;
                if (creditValue != null)
                {
                    rowDto.Credit = ParseDecimal(creditValue.ToString());
                }
            }

            // Parse Reference (אסמכתא) - optional
            if (columnMap.TryGetValue("Reference", out var refCol))
            {
                rowDto.Reference = worksheet.Cells[row, refCol]?.Value?.ToString()?.Trim();
            }

            // Parse Description (תיאור) - optional
            if (columnMap.TryGetValue("Description", out var descCol))
            {
                rowDto.Description = worksheet.Cells[row, descCol]?.Value?.ToString()?.Trim();
            }

            // Parse ActionType (סוג פעולה) - optional
            if (columnMap.TryGetValue("ActionType", out var actionTypeCol))
            {
                rowDto.ActionType = worksheet.Cells[row, actionTypeCol]?.Value?.ToString()?.Trim();
            }

            // Parse Date (תאריך) - required
            if (columnMap.TryGetValue("Date", out var dateCol))
            {
                var dateValue = worksheet.Cells[row, dateCol]?.Value;
                if (dateValue != null)
                {
                    rowDto.Date = ParseDate(dateValue);
                }
                else
                {
                    // Fallback to ValueDate if Date is empty
                    rowDto.Date = rowDto.ValueDate;
                }
            }
            else
            {
                // Fallback to ValueDate if Date column not found
                rowDto.Date = rowDto.ValueDate;
            }

            // Parse ForBenefitOf (לטובת) - optional
            if (columnMap.TryGetValue("ForBenefitOf", out var forBenefitOfCol))
            {
                rowDto.ForBenefitOf = worksheet.Cells[row, forBenefitOfCol]?.Value?.ToString()?.Trim();
            }

            // Parse For (עבור) - optional
            if (columnMap.TryGetValue("For", out var forCol))
            {
                rowDto.For = worksheet.Cells[row, forCol]?.Value?.ToString()?.Trim();
            }

            // Skip rows that are completely empty
            if (rowDto.Balance == null && rowDto.Debit == null && rowDto.Credit == null && 
                string.IsNullOrWhiteSpace(rowDto.Description))
            {
                return null;
            }

            return rowDto;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse row {RowNumber}", row);
            return null;
        }
    }

    // XLS methods
    private int FindHeaderRowXls(DataTable dataTable, int formatType = 1)
    {
        if (formatType == 3)
        {
            // In format 3, header row is usually row 3 (row index 2)
            // But verify it contains the expected headers
            if (dataTable.Rows.Count > 2)
            {
                var row3Text = string.Empty;
                var maxCols = Math.Min(dataTable.Columns.Count, 10);
                for (int col = 0; col < maxCols; col++)
                {
                    var cellValue = dataTable.Rows[2][col]?.ToString() ?? string.Empty;
                    row3Text += cellValue + " ";
                }
                
                if (row3Text.Contains("יתרה") || row3Text.Contains("תאריך") || row3Text.Contains("חובה") || row3Text.Contains("זכות"))
                {
                    return 2;
                }
            }
        }
        
        // Look for header row containing "יתרה" or "תאריך ערך"
        var maxRows = Math.Min(dataTable.Rows.Count, 10);
        var startRow = formatType == 3 ? 2 : 0;
        
        for (int row = startRow; row < maxRows; row++)
        {
            var rowText = string.Empty;
            var maxCols = Math.Min(dataTable.Columns.Count, 10);
            for (int col = 0; col < maxCols; col++)
            {
                var cellValue = dataTable.Rows[row][col]?.ToString() ?? string.Empty;
                rowText += cellValue + " ";
            }

            if (rowText.Contains("יתרה") || rowText.Contains("תאריך ערך"))
            {
                return row;
            }
        }

        return -1;
    }

    private Dictionary<string, int> MapColumnsXls(DataTable dataTable, int headerRow, int formatType = 1)
    {
        var map = new Dictionary<string, int>();

        for (int col = 0; col < dataTable.Columns.Count; col++)
        {
            var headerValue = dataTable.Rows[headerRow][col]?.ToString() ?? string.Empty;
            headerValue = headerValue.Trim();

            if (headerValue.Contains("יתרה"))
            {
                map["Balance"] = col;
            }
            else if (headerValue.Contains("תאריך ערך"))
            {
                map["ValueDate"] = col;
            }
            else if (headerValue.Contains("חובה"))
            {
                map["Debit"] = col;
            }
            else if (headerValue.Contains("זכות"))
            {
                map["Credit"] = col;
            }
            else if (headerValue.Contains("אסמכתא"))
            {
                map["Reference"] = col;
            }
            else if (headerValue.Contains("תיאור") || headerValue.Contains("פרטים"))
            {
                // Support both "תיאור" (old) and "פרטים" (new)
                map["Description"] = col;
            }
            else if (headerValue.Contains("סוג פעולה") || headerValue.Contains("הפעולה"))
            {
                // Support both "סוג פעולה" (old) and "הפעולה" (new)
                map["ActionType"] = col;
            }
            else if (headerValue.Contains("תאריך") && !headerValue.Contains("ערך"))
            {
                map["Date"] = col;
            }
            else if (headerValue.Contains("לטובת"))
            {
                map["ForBenefitOf"] = col;
            }
            else if (headerValue.Contains("עבור"))
            {
                map["For"] = col;
            }
        }

        return map;
    }

    private BankStatementRowDto? ParseRowXls(DataTable dataTable, int row, Dictionary<string, int> columnMap)
    {
        try
        {
            var rowDto = new BankStatementRowDto();

            // Parse Balance (יתרה) - optional
            if (columnMap.TryGetValue("Balance", out var balanceCol) && balanceCol < dataTable.Columns.Count)
            {
                var balanceValue = dataTable.Rows[row][balanceCol];
                if (balanceValue != null && balanceValue != DBNull.Value)
                {
                    rowDto.Balance = ParseDecimal(balanceValue.ToString());
                }
            }

            // Parse ValueDate (תאריך ערך) - required
            if (columnMap.TryGetValue("ValueDate", out var valueDateCol) && valueDateCol < dataTable.Columns.Count)
            {
                var valueDateValue = dataTable.Rows[row][valueDateCol];
                if (valueDateValue != null && valueDateValue != DBNull.Value)
                {
                    rowDto.ValueDate = ParseDate(valueDateValue);
                }
                else
                {
                    return null; // Skip rows without value date
                }
            }
            else
            {
                return null; // Skip rows without value date column
            }

            // Parse Debit (חובה) - optional
            if (columnMap.TryGetValue("Debit", out var debitCol) && debitCol < dataTable.Columns.Count)
            {
                var debitValue = dataTable.Rows[row][debitCol];
                if (debitValue != null && debitValue != DBNull.Value)
                {
                    rowDto.Debit = ParseDecimal(debitValue.ToString());
                }
            }

            // Parse Credit (זכות) - optional
            if (columnMap.TryGetValue("Credit", out var creditCol) && creditCol < dataTable.Columns.Count)
            {
                var creditValue = dataTable.Rows[row][creditCol];
                if (creditValue != null && creditValue != DBNull.Value)
                {
                    rowDto.Credit = ParseDecimal(creditValue.ToString());
                }
            }

            // Parse Reference (אסמכתא) - optional
            if (columnMap.TryGetValue("Reference", out var refCol) && refCol < dataTable.Columns.Count)
            {
                rowDto.Reference = dataTable.Rows[row][refCol]?.ToString()?.Trim();
            }

            // Parse Description (תיאור) - optional
            if (columnMap.TryGetValue("Description", out var descCol) && descCol < dataTable.Columns.Count)
            {
                rowDto.Description = dataTable.Rows[row][descCol]?.ToString()?.Trim();
            }

            // Parse ActionType (סוג פעולה) - optional
            if (columnMap.TryGetValue("ActionType", out var actionTypeCol) && actionTypeCol < dataTable.Columns.Count)
            {
                rowDto.ActionType = dataTable.Rows[row][actionTypeCol]?.ToString()?.Trim();
            }

            // Parse Date (תאריך) - required
            if (columnMap.TryGetValue("Date", out var dateCol) && dateCol < dataTable.Columns.Count)
            {
                var dateValue = dataTable.Rows[row][dateCol];
                if (dateValue != null && dateValue != DBNull.Value)
                {
                    rowDto.Date = ParseDate(dateValue);
                }
                else
                {
                    // Fallback to ValueDate if Date is empty
                    rowDto.Date = rowDto.ValueDate;
                }
            }
            else
            {
                // Fallback to ValueDate if Date column not found
                rowDto.Date = rowDto.ValueDate;
            }

            // Parse ForBenefitOf (לטובת) - optional
            if (columnMap.TryGetValue("ForBenefitOf", out var forBenefitOfCol) && forBenefitOfCol < dataTable.Columns.Count)
            {
                rowDto.ForBenefitOf = dataTable.Rows[row][forBenefitOfCol]?.ToString()?.Trim();
            }

            // Parse For (עבור) - optional
            if (columnMap.TryGetValue("For", out var forCol) && forCol < dataTable.Columns.Count)
            {
                rowDto.For = dataTable.Rows[row][forCol]?.ToString()?.Trim();
            }

            // Skip rows that are completely empty
            if (rowDto.Balance == null && rowDto.Debit == null && rowDto.Credit == null && 
                string.IsNullOrWhiteSpace(rowDto.Description))
            {
                return null;
            }

            return rowDto;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse row {RowNumber}", row);
            return null;
        }
    }

    // Shared helper methods - now using ExcelParsingHelper to avoid duplication
    private DateTime ParseDate(object? dateValue)
    {
        return ExcelParsingHelper.ParseDate(dateValue);
    }

    private decimal? ParseDecimal(string? value)
    {
        return ExcelParsingHelper.ParseDecimal(value);
    }
}
