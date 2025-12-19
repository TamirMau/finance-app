using FinanceApi.Models.DTOs;
using FinanceApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace FinanceApi.Controllers;

[Route("api/[controller]")]
public class CategoriesController : BaseController
{
    private readonly ICategoryService _categoryService;
    private readonly ILogger<CategoriesController> _logger;

    public CategoriesController(ICategoryService categoryService, ILogger<CategoriesController> logger)
    {
        _categoryService = categoryService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<CategoryDto>>> GetCategories()
    {
        try
        {
            var userId = GetUserId();
            var categories = await _categoryService.GetCategoriesAsync(userId);
            return Ok(categories);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting categories");
            return StatusCode(500, new { message = "An error occurred while retrieving categories" });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<CategoryDto>> GetCategory(int id)
    {
        try
        {
            var userId = GetUserId();
            var category = await _categoryService.GetCategoryByIdAsync(id, userId);
            
            if (category == null)
            {
                return NotFound(new { message = "Category not found" });
            }

            return Ok(category);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting category");
            return StatusCode(500, new { message = "An error occurred while retrieving the category" });
        }
    }

    [HttpPost]
    public async Task<ActionResult<CategoryDto>> CreateCategory([FromBody] CategoryDto categoryDto)
    {
        try
        {
            var userId = GetUserId();
            _logger.LogInformation("CreateCategory: User {UserId} creating category: {Name}, Type: {Type}", 
                userId, categoryDto.Name, categoryDto.Type);

            if (!ModelState.IsValid)
            {
                _logger.LogWarning("CreateCategory: Invalid model state. User: {UserId}, Category: {Name}", 
                    userId, categoryDto.Name);
                return BadRequest(ModelState);
            }

            var result = await _categoryService.CreateCategoryAsync(categoryDto, userId);
            
            _logger.LogInformation("CreateCategory: Category created successfully. User: {UserId}, CategoryId: {CategoryId}, Name: {Name}", 
                userId, result.Id, result.Name);
            
            return CreatedAtAction(nameof(GetCategory), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            var userId = GetUserId();
            _logger.LogWarning("CreateCategory: Invalid operation. User: {UserId}, Category: {Name}, Error: {Error}", 
                userId, categoryDto.Name, ex.Message);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            var userId = GetUserId();
            _logger.LogError(ex, "CreateCategory: Error creating category. User: {UserId}, Category: {Name}", 
                userId, categoryDto.Name);
            return StatusCode(500, new { message = "An error occurred while creating the category" });
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<CategoryDto>> UpdateCategory(int id, [FromBody] CategoryDto categoryDto)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userId = GetUserId();
            var result = await _categoryService.UpdateCategoryAsync(id, categoryDto, userId);
            
            if (result == null)
            {
                return NotFound(new { message = "Category not found" });
            }

            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating category");
            return StatusCode(500, new { message = "An error occurred while updating the category" });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        try
        {
            var userId = GetUserId();
            _logger.LogInformation("DeleteCategory: User {UserId} attempting to delete category {CategoryId}", userId, id);
            
            try
            {
                var deleted = await _categoryService.DeleteCategoryAsync(id, userId);
                
                if (!deleted)
                {
                    _logger.LogWarning("DeleteCategory: Category not found. User: {UserId}, CategoryId: {CategoryId}", 
                        userId, id);
                    return NotFound(new { message = "Category not found" });
                }

                _logger.LogInformation("DeleteCategory: Category deleted successfully. User: {UserId}, CategoryId: {CategoryId}", 
                    userId, id);
                
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning("DeleteCategory: Invalid operation. User: {UserId}, CategoryId: {CategoryId}, Error: {Error}", 
                    userId, id, ex.Message);
                return BadRequest(new { message = ex.Message });
            }
        }
        catch (Exception ex)
        {
            var userId = GetUserId();
            _logger.LogError(ex, "DeleteCategory: Error deleting category. User: {UserId}, CategoryId: {CategoryId}", 
                userId, id);
            return StatusCode(500, new { message = "An error occurred while deleting the category" });
        }
    }

    [HttpPost("update-colors")]
    public async Task<ActionResult<List<CategoryDto>>> UpdateCategoriesWithColors()
    {
        try
        {
            var userId = GetUserId();
            var categories = await _categoryService.UpdateCategoriesWithColorsAsync(userId);
            return Ok(categories);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating category colors");
            return StatusCode(500, new { message = "An error occurred while updating category colors" });
        }
    }
}

