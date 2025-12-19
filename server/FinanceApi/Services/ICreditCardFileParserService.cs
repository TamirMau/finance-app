using FinanceApi.Models.DTOs;

namespace FinanceApi.Services;

public interface ICreditCardFileParserService
{
    Task<List<TransactionDto>> ParseFileAsync(Stream fileStream, string fileName, int userId);
    
    /// <summary>
    /// Extracts month and year from a file stream.
    /// Returns null if month/year cannot be extracted.
    /// </summary>
    (int Year, int Month)? ExtractMonthYearFromFile(Stream fileStream, string fileName);
}


