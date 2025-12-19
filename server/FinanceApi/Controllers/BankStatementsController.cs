using FinanceApi.Models.DTOs;
using FinanceApi.Services;
using FinanceApi.Data;
using FinanceApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FinanceApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BankStatementsController : BaseController
{
    private readonly IBankStatementParserService _parserService;
    private readonly IStorageService _storageService;
    private readonly ILogger<BankStatementsController> _logger;

    public BankStatementsController(
        IBankStatementParserService parserService,
        IStorageService storageService,
        ILogger<BankStatementsController> logger)
    {
        _parserService = parserService;
        _storageService = storageService;
        _logger = logger;
    }

    [HttpGet]
    public ActionResult<BankStatementDto> GetBankStatement()
    {
        try
        {
            var userId = GetUserId();
            var bankStatement = _storageService.GetBankStatementByUserId(userId);
            
            if (bankStatement == null)
            {
                return Ok(new BankStatementDto
                {
                    AccountNumber = string.Empty,
                    StatementDate = DateTime.Now,
                    Rows = new List<BankStatementRowDto>()
                });
            }

            var dto = new BankStatementDto
            {
                AccountNumber = bankStatement.AccountNumber,
                StatementDate = bankStatement.StatementDate,
                Balance = bankStatement.Balance,
                Rows = bankStatement.Rows.Select(r => new BankStatementRowDto
                {
                    Balance = r.Balance,
                    ValueDate = r.ValueDate,
                    Debit = r.Debit,
                    Credit = r.Credit,
                    Reference = r.Reference,
                    Description = r.Description,
                    ActionType = r.ActionType,
                    Date = r.Date,
                    ForBenefitOf = r.ForBenefitOf,
                    For = r.For
                }).ToList()
            };

            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading bank statement");
            return StatusCode(500, new BankStatementDto
            {
                AccountNumber = string.Empty,
                StatementDate = DateTime.Now,
                Rows = new List<BankStatementRowDto>()
            });
        }
    }

    [HttpPost("upload")]
    public async Task<ActionResult<BankStatementUploadResponseDto>> UploadBankStatement(
        IFormFile file)
    {
        try
        {
            var userId = GetUserId();
            _logger.LogInformation("UploadBankStatement: User {UserId} uploading bank statement file: {FileName}, size: {FileSize} bytes", 
                userId, file?.FileName, file?.Length);

            if (file == null || file.Length == 0)
            {
                _logger.LogWarning("UploadBankStatement: No file uploaded or file is empty. User: {UserId}", userId);
                return BadRequest(new BankStatementUploadResponseDto
                {
                    Success = false,
                    Message = "No file uploaded"
                });
            }

            // Validate file extension - support both .xlsx and .xls
            var allowedExtensions = new[] { ".xlsx", ".xls" };
            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(fileExtension))
            {
                _logger.LogWarning("UploadBankStatement: Invalid file extension. User: {UserId}, Extension: {Extension}, FileName: {FileName}", 
                    userId, fileExtension, file.FileName);
                return BadRequest(new BankStatementUploadResponseDto
                {
                    Success = false,
                    Message = "Invalid file type. Only Excel files (.xlsx, .xls) are supported."
                });
            }

            BankStatementDto statement;
            try
            {
                _logger.LogInformation("UploadBankStatement: Parsing file. User: {UserId}, FileName: {FileName}", userId, file.FileName);
                
                using (var stream = file.OpenReadStream())
                {
                    statement = await _parserService.ParseFileAsync(stream, file.FileName);
                }
                
                _logger.LogInformation("UploadBankStatement: File parsed successfully. User: {UserId}, Rows: {RowCount}", 
                    userId, statement?.Rows?.Count ?? 0);
            }
            catch (InvalidDataException ex)
            {
                _logger.LogWarning(ex, "UploadBankStatement: Invalid Excel file format. User: {UserId}, FileName: {FileName}, Error: {Error}", 
                    userId, file.FileName, ex.Message);
                return BadRequest(new BankStatementUploadResponseDto
                {
                    Success = false,
                    Message = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UploadBankStatement: Error parsing file. User: {UserId}, FileName: {FileName}, Size: {FileSize}", 
                    userId, file.FileName, file.Length);
                return StatusCode(500, new BankStatementUploadResponseDto
                {
                    Success = false,
                    Message = $"Error parsing file: {ex.Message}"
                });
            }
            
            if (statement == null)
            {
                _logger.LogWarning("UploadBankStatement: Statement is null after parsing. User: {UserId}, FileName: {FileName}", 
                    userId, file.FileName);
                return BadRequest(new BankStatementUploadResponseDto
                {
                    Success = false,
                    Message = "Failed to parse file"
                });
            }

            if (statement.Rows == null || statement.Rows.Count == 0)
            {
                _logger.LogWarning("UploadBankStatement: No data rows found in file. User: {UserId}, FileName: {FileName}", 
                    userId, file.FileName);
                return BadRequest(new BankStatementUploadResponseDto
                {
                    Success = false,
                    Message = "No data rows found in the file"
                });
            }

            // Save to storage
            bool savedToStorage = true;
            try
            {
                _logger.LogInformation("UploadBankStatement: Saving to storage. User: {UserId}, Rows: {RowCount}", 
                    userId, statement.Rows.Count);
                _storageService.SaveOrUpdateBankStatement(userId, statement);
                _logger.LogInformation("UploadBankStatement: Saved to storage successfully. User: {UserId}", userId);
            }
            catch (Exception ex)
            {
                savedToStorage = false;
                _logger.LogError(ex, "UploadBankStatement: Error saving to storage. User: {UserId}, FileName: {FileName}", 
                    userId, file.FileName);
            }

            if (!savedToStorage)
            {
                return StatusCode(500, new BankStatementUploadResponseDto
                {
                    Success = false,
                    Message = "Error saving bank statement to storage. See server logs for details.",
                    Statement = statement,
                    TotalRows = statement.Rows.Count
                });
            }

            return Ok(new BankStatementUploadResponseDto
            {
                Success = true,
                Message = "Bank statement parsed successfully",
                Statement = statement,
                TotalRows = statement.Rows.Count
            });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Invalid bank statement file format");
            return BadRequest(new BankStatementUploadResponseDto
            {
                Success = false,
                Message = ex.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing bank statement file: {Message}", ex.Message);
            _logger.LogError(ex, "Stack trace: {StackTrace}", ex.StackTrace);
            return StatusCode(500, new BankStatementUploadResponseDto
            {
                Success = false,
                Message = $"An error occurred while processing the file: {ex.Message}"
            });
        }
    }

    [HttpGet("credits")]
    public ActionResult<BankStatementDto> GetBankStatementForDashboard()
    {
        try
        {
            var userId = GetUserId();
            var bankStatement = _storageService.GetBankStatementByUserId(userId);
            
            if (bankStatement == null)
            {
                return Ok(new BankStatementDto
                {
                    AccountNumber = string.Empty,
                    StatementDate = DateTime.Now,
                    Balance = null,
                    Rows = new List<BankStatementRowDto>()
                });
            }

            // Return the full bank statement with balance
            var dto = new BankStatementDto
            {
                AccountNumber = bankStatement.AccountNumber,
                StatementDate = bankStatement.StatementDate,
                Balance = bankStatement.Balance,
                Rows = bankStatement.Rows?.Select(r => new BankStatementRowDto
                {
                    Balance = r.Balance,
                    ValueDate = r.ValueDate,
                    Debit = r.Debit,
                    Credit = r.Credit,
                    Reference = r.Reference,
                    Description = r.Description,
                    ActionType = r.ActionType,
                    Date = r.Date
                }).ToList() ?? new List<BankStatementRowDto>()
            };

            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading bank statement for dashboard");
            return StatusCode(500, new BankStatementDto
            {
                AccountNumber = string.Empty,
                StatementDate = DateTime.Now,
                Balance = null,
                Rows = new List<BankStatementRowDto>()
            });
        }
    }
}

