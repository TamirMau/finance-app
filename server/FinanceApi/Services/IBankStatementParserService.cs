using FinanceApi.Models.DTOs;

namespace FinanceApi.Services;

public interface IBankStatementParserService
{
    /// <summary>
    /// Parses an Excel file containing bank account statement (עובר ושב)
    /// </summary>
    /// <param name="fileStream">The Excel file stream</param>
    /// <param name="fileName">The name of the file</param>
    /// <returns>Parsed bank statement DTO</returns>
    Task<BankStatementDto> ParseFileAsync(Stream fileStream, string fileName);
}


