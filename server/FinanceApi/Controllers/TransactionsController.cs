using FinanceApi.Models.DTOs;
using FinanceApi.Services;
using Microsoft.AspNetCore.Mvc;
using System.IO;

namespace FinanceApi.Controllers;

[Route("api/[controller]")]
public class TransactionsController : BaseController
{
    private readonly ITransactionService _transactionService;
    private readonly ICategoryService _categoryService;
    private readonly ICreditCardFileParserService _fileParserService;
    private readonly ILogger<TransactionsController> _logger;

    public TransactionsController(
        ITransactionService transactionService,
        ICategoryService categoryService,
        ICreditCardFileParserService fileParserService,
        ILogger<TransactionsController> logger)
    {
        _transactionService = transactionService;
        _categoryService = categoryService;
        _fileParserService = fileParserService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetTransactions(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int? categoryId,
        [FromQuery] string? type,
        [FromQuery] int? page,
        [FromQuery] int? pageSize)
    {
        try
        {
            var userId = GetUserId();
            
            // If pagination parameters are provided, use paginated endpoint
            if (page.HasValue || pageSize.HasValue)
            {
                var pagedResult = await _transactionService.GetTransactionsPagedAsync(
                    userId, 
                    page ?? 1, 
                    pageSize ?? 50, 
                    startDate, 
                    endDate, 
                    categoryId, 
                    type);
                return Ok(pagedResult);
            }
            
            // Otherwise, return all transactions (backward compatibility)
            var transactions = await _transactionService.GetTransactionsAsync(userId, startDate, endDate, categoryId, type);
            return Ok(transactions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting transactions");
            return StatusCode(500, new { message = "An error occurred while retrieving transactions" });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TransactionDto>> GetTransaction(int id)
    {
        try
        {
            var userId = GetUserId();
            var transaction = await _transactionService.GetTransactionByIdAsync(id, userId);
            
            if (transaction == null)
            {
                return NotFound(new { message = "Transaction not found" });
            }

            return Ok(transaction);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting transaction");
            return StatusCode(500, new { message = "An error occurred while retrieving the transaction" });
        }
    }

    /// <summary>
    /// Sets default values for Income transactions before validation
    /// </summary>
    private void SetIncomeTransactionDefaults(TransactionDto transactionDto)
    {
        if (transactionDto.Type == "Income" && string.IsNullOrWhiteSpace(transactionDto.MerchantName))
        {
            transactionDto.MerchantName = !string.IsNullOrWhiteSpace(transactionDto.Source) 
                ? transactionDto.Source 
                : "Income";
            // Clear any validation errors for MerchantName since we set a default
            ModelState.Remove(nameof(TransactionDto.MerchantName));
        }
    }

    /// <summary>
    /// Validates year and month parameters
    /// </summary>
    private ActionResult? ValidateYearAndMonth(int year, int month)
    {
        if (year < 2000 || year > 2100)
        {
            return BadRequest(new { message = "Invalid year" });
        }
        if (month < 1 || month > 12)
        {
            return BadRequest(new { message = "Invalid month" });
        }
        return null;
    }

    /// <summary>
    /// Processes transactions to assign categories based on Branch field
    /// Optimized to avoid N+1 queries by processing unique branches in batch
    /// </summary>
    private async Task ProcessTransactionCategoriesAsync(List<TransactionDto> transactions, int userId)
    {
        // Collect all unique branches (including "אחר" for transactions without branch)
        var branches = transactions
            .Select(t => string.IsNullOrWhiteSpace(t.Branch) ? "אחר" : t.Branch.Trim())
            .Distinct()
            .ToList();

        // Create a dictionary to cache category lookups
        var categoryCache = new Dictionary<string, CategoryDto?>();

        // Process each unique branch once
        foreach (var branch in branches)
        {
            var category = await _categoryService.FindOrCreateCategoryByBranchAsync(branch, userId);
            categoryCache[branch] = category;
        }

        // Map categories to transactions using the cache
        foreach (var transaction in transactions)
        {
            var branchKey = string.IsNullOrWhiteSpace(transaction.Branch) ? "אחר" : transaction.Branch.Trim();
            if (categoryCache.TryGetValue(branchKey, out var category) && category != null)
            {
                transaction.CategoryId = category.Id;
                transaction.CategoryName = category.Name;
            }
        }
    }

    [HttpPost]
    public async Task<ActionResult<TransactionDto>> CreateTransaction([FromBody] TransactionDto transactionDto)
    {
        try
        {
            var userId = GetUserId();
            _logger.LogInformation("CreateTransaction: User {UserId} attempting to create {Type} transaction, amount: {Amount}, merchant: {Merchant}", 
                userId, transactionDto.Type, transactionDto.Amount, transactionDto.MerchantName);

            SetIncomeTransactionDefaults(transactionDto);

            if (!ModelState.IsValid)
            {
                _logger.LogWarning("CreateTransaction: Invalid model state for user {UserId}, errors: {Errors}", 
                    userId, string.Join(", ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage)));
                return BadRequest(ModelState);
            }

            var result = await _transactionService.CreateTransactionAsync(transactionDto, userId);
            
            _logger.LogInformation("CreateTransaction: Transaction created successfully. ID: {TransactionId}, User: {UserId}, Type: {Type}", 
                result.Id, userId, result.Type);
            
            return CreatedAtAction(nameof(GetTransaction), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            var userId = GetUserId();
            _logger.LogWarning("CreateTransaction: Invalid operation for user {UserId}. Error: {Error}", userId, ex.Message);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            var userId = GetUserId();
            _logger.LogError(ex, "CreateTransaction: Error creating transaction for user {UserId}, type: {Type}, amount: {Amount}", 
                userId, transactionDto.Type, transactionDto.Amount);
            return StatusCode(500, new { message = "An error occurred while creating the transaction" });
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<TransactionDto>> UpdateTransaction(int id, [FromBody] TransactionDto transactionDto)
    {
        try
        {
            SetIncomeTransactionDefaults(transactionDto);

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userId = GetUserId();
            var result = await _transactionService.UpdateTransactionAsync(id, transactionDto, userId);
            
            if (result == null)
            {
                return NotFound(new { message = "Transaction not found" });
            }

            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating transaction");
            return StatusCode(500, new { message = "An error occurred while updating the transaction" });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTransaction(int id)
    {
        try
        {
            var userId = GetUserId();
            _logger.LogInformation("DeleteTransaction: User {UserId} attempting to delete transaction {TransactionId}", userId, id);
            
            var deleted = await _transactionService.DeleteTransactionAsync(id, userId);
            
            if (!deleted)
            {
                _logger.LogWarning("DeleteTransaction: Transaction not found. User: {UserId}, TransactionId: {TransactionId}", 
                    userId, id);
                return NotFound(new { message = "Transaction not found" });
            }

            _logger.LogInformation("DeleteTransaction: Transaction deleted successfully. User: {UserId}, TransactionId: {TransactionId}", 
                userId, id);
            
            return NoContent();
        }
        catch (Exception ex)
        {
            var userId = GetUserId();
            _logger.LogError(ex, "DeleteTransaction: Error deleting transaction. User: {UserId}, TransactionId: {TransactionId}", 
                userId, id);
            return StatusCode(500, new { message = "An error occurred while deleting the transaction" });
        }
    }

    [HttpPost("upload")]
    public async Task<ActionResult<object>> UploadTransactionsFile(
        IFormFile file,
        [FromQuery] int? year = null,
        [FromQuery] int? month = null)
    {
        try
        {
            var userId = GetUserId();
            _logger.LogInformation("UploadTransactionsFile: User {UserId} uploading file: {FileName}, size: {FileSize} bytes, month: {Month}/{Year}", 
                userId, file?.FileName, file?.Length, month, year);

            if (file == null || file.Length == 0)
            {
                _logger.LogWarning("UploadTransactionsFile: No file uploaded for user {UserId}", userId);
                return BadRequest(new { message = "No file uploaded" });
            }

            var fileName = file.FileName;
            DateTime assignedMonthDate;

            // If year/month not provided, extract from file
            if (year == null || month == null)
            {
                // Read file into memory stream so we can use it multiple times
                using (var memoryStream = new MemoryStream())
                {
                    await file.CopyToAsync(memoryStream);
                    memoryStream.Position = 0;
                    
                    var monthYear = _fileParserService.ExtractMonthYearFromFile(memoryStream, fileName);
                    if (!monthYear.HasValue)
                    {
                        _logger.LogWarning("UploadTransactionsFile: Could not extract month/year from file. User: {UserId}, FileName: {FileName}", 
                            userId, fileName);
                        return BadRequest(new { message = "לא ניתן לזהות חודש ושנה בקובץ. אנא ודא שהקובץ מכיל תאריך ב-A3 או C2" });
                    }
                    
                    // Subtract one month from the extracted month/year
                    // If month is January (1), go back to December of previous year
                    if (monthYear.Value.Month == 1)
                    {
                        year = monthYear.Value.Year - 1;
                        month = 12;
                    }
                    else
                    {
                        year = monthYear.Value.Year;
                        month = monthYear.Value.Month - 1;
                    }
                    
                    _logger.LogInformation("UploadTransactionsFile: Adjusted month/year (subtracted 1 month). Original: {OriginalMonth}/{OriginalYear}, Adjusted: {AdjustedMonth}/{AdjustedYear}", 
                        monthYear.Value.Month, monthYear.Value.Year, month, year);
                }
            }

            var validationError = ValidateYearAndMonth(year.Value, month.Value);
            if (validationError != null)
            {
                _logger.LogWarning("UploadTransactionsFile: Invalid year/month. User: {UserId}, Year: {Year}, Month: {Month}", 
                    userId, year, month);
                return validationError;
            }

            assignedMonthDate = new DateTime(year.Value, month.Value, 1);

            _logger.LogInformation("UploadTransactionsFile: Parsing file for user {UserId}, fileName: {FileName}, month: {Month}/{Year}", 
                userId, fileName, month, year);
            
            // Parse the file
            List<TransactionDto> parsedTransactions;
            using (var stream = file.OpenReadStream())
            {
                parsedTransactions = await _fileParserService.ParseFileAsync(stream, fileName, userId);
            }

            _logger.LogInformation("UploadTransactionsFile: File parsed. User: {UserId}, Parsed transactions: {Count}", 
                userId, parsedTransactions.Count);

            if (parsedTransactions.Count == 0)
            {
                _logger.LogWarning("UploadTransactionsFile: No transactions found in file. User: {UserId}, FileName: {FileName}", 
                    userId, fileName);
                return BadRequest(new { message = "No transactions found in file" });
            }

            _logger.LogInformation("UploadTransactionsFile: Processing categories for {Count} transactions, user: {UserId}", 
                parsedTransactions.Count, userId);
            
            // Process each transaction: find or create category from Branch
            await ProcessTransactionCategoriesAsync(parsedTransactions, userId);

            _logger.LogInformation("UploadTransactionsFile: Bulk creating {Count} transactions for user {UserId}, month: {Month}/{Year}", 
                parsedTransactions.Count, userId, month, year);
            
            // Bulk create transactions with assigned month date
            var result = await _transactionService.BulkCreateTransactionsAsync(parsedTransactions, userId, assignedMonthDate);

            _logger.LogInformation("UploadTransactionsFile: Upload completed successfully. User: {UserId}, Parsed: {Parsed}, Created: {Created}", 
                userId, parsedTransactions.Count, result.CreatedTransactions.Count);

            return Ok(new
            {
                message = "File uploaded successfully",
                totalParsed = parsedTransactions.Count,
                totalCreated = result.CreatedTransactions.Count,
                transactions = result.CreatedTransactions
            });
        }
        catch (NotSupportedException ex)
        {
            var userId = GetUserId();
            _logger.LogWarning("UploadTransactionsFile: Unsupported file format. User: {UserId}, FileName: {FileName}, Error: {Error}", 
                userId, file?.FileName, ex.Message);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            var userId = GetUserId();
            _logger.LogError(ex, "UploadTransactionsFile: Error uploading file. User: {UserId}, FileName: {FileName}, Size: {FileSize}", 
                userId, file?.FileName, file?.Length);
            return StatusCode(500, new { message = "An error occurred while processing the file" });
        }
    }

    [HttpPost("upload-json")]
    public async Task<ActionResult<object>> UploadTransactionsJson(
        [FromBody] List<TransactionDto> transactions,
        [FromQuery] int year,
        [FromQuery] int month)
    {
        try
        {
            if (transactions == null || transactions.Count == 0)
            {
                return BadRequest(new { message = "No transactions provided" });
            }

            var validationError = ValidateYearAndMonth(year, month);
            if (validationError != null)
            {
                return validationError;
            }

            var userId = GetUserId();
            var assignedMonthDate = new DateTime(year, month, 1);

            // Process each transaction: find or create category from Branch
            await ProcessTransactionCategoriesAsync(transactions, userId);

            // Bulk create transactions with assigned month date
            var result = await _transactionService.BulkCreateTransactionsAsync(transactions, userId, assignedMonthDate);

            return Ok(new
            {
                message = "Transactions uploaded successfully",
                totalParsed = transactions.Count,
                totalCreated = result.CreatedTransactions.Count,
                transactions = result.CreatedTransactions
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading transactions JSON");
            return StatusCode(500, new { message = "An error occurred while processing the transactions" });
        }
    }

    [HttpPatch("{id}/is-halves")]
    public async Task<ActionResult<TransactionDto>> UpdateIsHalves(int id, [FromBody] UpdateIsHalvesRequest request)
    {
        try
        {
            var userId = GetUserId();
            var transaction = await _transactionService.GetTransactionByIdAsync(id, userId);
            
            if (transaction == null)
            {
                return NotFound(new { message = "Transaction not found" });
            }

            transaction.IsHalves = request.IsHalves;
            var result = await _transactionService.UpdateTransactionAsync(id, transaction, userId);
            
            if (result == null)
            {
                return NotFound(new { message = "Transaction not found" });
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating IsHalves for transaction {TransactionId}", id);
            return StatusCode(500, new { message = "An error occurred while updating the transaction" });
        }
    }
}

