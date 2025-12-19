using FinanceApi.Models.DTOs;

namespace FinanceApi.Services;

public interface ICategoryService
{
    Task<List<CategoryDto>> GetCategoriesAsync(int userId);
    Task<CategoryDto?> GetCategoryByIdAsync(int id, int userId);
    Task<CategoryDto> CreateCategoryAsync(CategoryDto categoryDto, int userId);
    Task<CategoryDto?> UpdateCategoryAsync(int id, CategoryDto categoryDto, int userId);
    Task<bool> DeleteCategoryAsync(int id, int userId);
    Task<CategoryDto?> FindOrCreateCategoryByBranchAsync(string branchName, int userId);
    Task<List<CategoryDto>> UpdateCategoriesWithColorsAsync(int userId);
}

