using FinanceApi.Data;
using FinanceApi.Helpers;
using FinanceApi.Models;
using FinanceApi.Models.DTOs;

namespace FinanceApi.Services;

public class CategoryService : ICategoryService
{
    private readonly IStorageService _storage;
    private readonly ILogger<CategoryService> _logger;

    public CategoryService(IStorageService storage, ILogger<CategoryService> logger)
    {
        _storage = storage;
        _logger = logger;
    }

    public Task<List<CategoryDto>> GetCategoriesAsync(int userId)
    {
        // מחזיר קטגוריות ציבוריות (UserId == null) + קטגוריות פרטיות של המשתמש (UserId == userId)
        var categories = _storage.GetCategoriesByUserId(userId);
        
        var dtos = categories.Select(c => new CategoryDto
        {
            Id = c.Id,
            Name = c.Name,
            Color = c.Color,
            Icon = c.Icon,
            Type = c.Type ?? "Expense",
            MerchantAliases = c.MerchantAliases ?? new List<string>()
        }).ToList();

        return Task.FromResult(dtos);
    }

    public Task<CategoryDto?> GetCategoryByIdAsync(int id, int userId)
    {
        var category = _storage.GetCategoryById(id);
        
        // קטגוריה ציבורית (UserId == null) או קטגוריה פרטית של המשתמש
        if (category == null || (category.UserId.HasValue && category.UserId != userId))
        {
            return Task.FromResult<CategoryDto?>(null);
        }

        return Task.FromResult<CategoryDto?>(new CategoryDto
        {
            Id = category.Id,
            Name = category.Name,
            Color = category.Color,
            Icon = category.Icon,
            Type = category.Type ?? "Expense",
            MerchantAliases = category.MerchantAliases ?? new List<string>()
        });
    }

    public Task<CategoryDto> CreateCategoryAsync(CategoryDto categoryDto, int userId)
    {
        // Check if category name already exists for this user (including public categories)
        var existingCategories = _storage.GetCategoriesByUserId(userId);
        if (existingCategories.Any(c => c.Name.Equals(categoryDto.Name, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("Category name already exists for this user");
        }

        // Auto-assign color if not provided or is default
        var color = categoryDto.Color;
        if (string.IsNullOrWhiteSpace(color) || color == "#2196F3" || color == "#000000")
        {
            var usedColors = existingCategories.Select(c => c.Color).Where(c => !string.IsNullOrWhiteSpace(c) && c != "#2196F3" && c != "#000000").ToList();
            color = CategoryColorPalette.GetNextAvailableColor(usedColors);
        }

        // קטגוריות שנוצרות ידנית על ידי משתמשים הן פרטיות (עם UserId)
        // Validate Type - only Income or Expense allowed
        if (categoryDto.Type != null && categoryDto.Type != "Income" && categoryDto.Type != "Expense")
        {
            throw new InvalidOperationException("Type must be 'Income' or 'Expense'");
        }

        var category = new Category
        {
            UserId = userId, // קטגוריה פרטית - עם UserId
            Name = categoryDto.Name,
            Color = color,
            Icon = categoryDto.Icon,
            Type = categoryDto.Type ?? "Expense",
            MerchantAliases = categoryDto.MerchantAliases ?? new List<string>()
        };

        category = _storage.CreateCategory(category);

        categoryDto.Id = category.Id;
        categoryDto.Color = color;

        return Task.FromResult(categoryDto);
    }

    public Task<CategoryDto?> UpdateCategoryAsync(int id, CategoryDto categoryDto, int userId)
    {
        var category = _storage.GetCategoryById(id);
        
        // לא ניתן לעדכן קטגוריה ציבורית (UserId == null) - רק קטגוריות פרטיות
        if (category == null || category.UserId == null || category.UserId != userId)
        {
            if (category != null && category.UserId == null)
            {
                throw new InvalidOperationException("Cannot update public category");
            }
            return Task.FromResult<CategoryDto?>(null);
        }

        // Check if new name already exists for this user (excluding current category)
        var existingCategories = _storage.GetCategoriesByUserId(userId);
        if (existingCategories.Any(c => c.Id != id && c.Name.Equals(categoryDto.Name, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("Category name already exists for this user");
        }

        category.Name = categoryDto.Name;
        category.Color = categoryDto.Color;
        category.Icon = categoryDto.Icon;
        // Validate Type when updating
        if (categoryDto.Type != null && categoryDto.Type != "Income" && categoryDto.Type != "Expense")
        {
            throw new InvalidOperationException("Type must be 'Income' or 'Expense'");
        }

        category.Type = categoryDto.Type ?? "Expense";
        category.MerchantAliases = categoryDto.MerchantAliases ?? new List<string>();

        _storage.UpdateCategory(category);

        categoryDto.Id = category.Id;

        return Task.FromResult<CategoryDto?>(categoryDto);
    }

    public Task<bool> DeleteCategoryAsync(int id, int userId)
    {
        var category = _storage.GetCategoryById(id);
        
        // לא ניתן למחוק קטגוריה ציבורית (UserId == null) - רק קטגוריות פרטיות
        if (category == null || category.UserId == null || category.UserId != userId)
        {
            if (category != null && category.UserId == null)
            {
                throw new InvalidOperationException("Cannot delete public category");
            }
            return Task.FromResult(false);
        }

        // Check if category has transactions
        if (_storage.CategoryHasTransactions(id))
        {
            throw new InvalidOperationException("Cannot delete category with existing transactions");
        }

        return Task.FromResult(_storage.DeleteCategory(id));
    }

    public Task<CategoryDto?> FindOrCreateCategoryByBranchAsync(string branchName, int userId)
    {
        if (string.IsNullOrWhiteSpace(branchName))
        {
            return Task.FromResult<CategoryDto?>(null);
        }

        // קודם כל, נחפש קטגוריה ציבורית קיימת (ללא UserId) - למניעת כפילויות
        var existingPublicCategory = _storage.FindPublicCategoryByName(branchName);
        
        if (existingPublicCategory != null)
        {
            // Ensure category has a color - assign one if missing or default
            if (string.IsNullOrWhiteSpace(existingPublicCategory.Color) || existingPublicCategory.Color == "#2196F3" || existingPublicCategory.Color == "#000000")
            {
                var allPublicCategories = _storage.GetPublicCategories();
                var usedColorsForUpdate = allPublicCategories.Select(c => c.Color).Where(c => !string.IsNullOrWhiteSpace(c) && c != "#2196F3" && c != "#000000").ToList();
                var newColor = CategoryColorPalette.GetNextAvailableColor(usedColorsForUpdate);
                existingPublicCategory.Color = newColor;
                _storage.UpdateCategory(existingPublicCategory);
            }
            
            return Task.FromResult<CategoryDto?>(new CategoryDto
            {
                Id = existingPublicCategory.Id,
                Name = existingPublicCategory.Name,
                Color = existingPublicCategory.Color,
                Icon = existingPublicCategory.Icon,
                Type = existingPublicCategory.Type ?? "Expense",
                MerchantAliases = existingPublicCategory.MerchantAliases ?? new List<string>()
            });
        }

        // אם לא נמצאה קטגוריה ציבורית, נחפש בקטגוריות של המשתמש (ציבוריות + פרטיות)
        var existingCategories = _storage.GetCategoriesByUserId(userId);
        var existingCategory = existingCategories.FirstOrDefault(c => 
            c.Name.Equals(branchName, StringComparison.OrdinalIgnoreCase) ||
            (c.MerchantAliases != null && c.MerchantAliases.Any(a => a.Equals(branchName, StringComparison.OrdinalIgnoreCase))));

        if (existingCategory != null)
        {
            // Ensure category has a color - assign one if missing or default
            if (string.IsNullOrWhiteSpace(existingCategory.Color) || existingCategory.Color == "#2196F3" || existingCategory.Color == "#000000")
            {
                var usedColorsForUpdate = existingCategories.Select(c => c.Color).Where(c => !string.IsNullOrWhiteSpace(c) && c != "#2196F3" && c != "#000000").ToList();
                var newColor = CategoryColorPalette.GetNextAvailableColor(usedColorsForUpdate);
                existingCategory.Color = newColor;
                _storage.UpdateCategory(existingCategory);
            }
            
            return Task.FromResult<CategoryDto?>(new CategoryDto
            {
                Id = existingCategory.Id,
                Name = existingCategory.Name,
                Color = existingCategory.Color,
                Icon = existingCategory.Icon,
                Type = existingCategory.Type ?? "Expense",
                MerchantAliases = existingCategory.MerchantAliases ?? new List<string>()
            });
        }

        // אם לא נמצאה קטגוריה קיימת, ניצור קטגוריה ציבורית חדשה (ללא UserId)
        // קטגוריות מטעינת קבצים הן ציבוריות וזמינות לכל המשתמשים
        var publicCategories = _storage.GetPublicCategories();
        var usedColors = publicCategories.Select(c => c.Color).Where(c => !string.IsNullOrWhiteSpace(c)).ToList();
        var color = CategoryColorPalette.GetNextAvailableColor(usedColors);

        // Create new public category (UserId = null)
        var newCategory = new Category
        {
            UserId = null, // קטגוריה ציבורית - ללא UserId
            Name = branchName,
            Color = color,
            Icon = string.Empty, // Default icon
            Type = "Expense", // Default to Expense for branch-based categories
            MerchantAliases = new List<string>()
        };

        newCategory = _storage.CreateCategory(newCategory);

        return Task.FromResult<CategoryDto?>(new CategoryDto
        {
            Id = newCategory.Id,
            Name = newCategory.Name,
            Color = newCategory.Color,
            Icon = newCategory.Icon,
            Type = newCategory.Type ?? "Expense",
            MerchantAliases = newCategory.MerchantAliases ?? new List<string>()
        });
    }

    public Task<List<CategoryDto>> UpdateCategoriesWithColorsAsync(int userId)
    {
        // רק קטגוריות פרטיות של המשתמש (לא קטגוריות ציבוריות)
        var categories = _storage.GetCategoriesByUserId(userId).Where(c => c.UserId == userId).ToList();
        var updatedCategories = new List<CategoryDto>();
        var usedColors = new List<string>();

        // First pass: collect existing colors
        foreach (var category in categories)
        {
            if (!string.IsNullOrWhiteSpace(category.Color) && category.Color != "#2196F3")
            {
                usedColors.Add(category.Color);
            }
        }

        // Second pass: update categories without colors or with default color
        foreach (var category in categories)
        {
            if (string.IsNullOrWhiteSpace(category.Color) || category.Color == "#2196F3")
            {
                var newColor = CategoryColorPalette.GetNextAvailableColor(usedColors);
                category.Color = newColor;
                usedColors.Add(newColor);
                _storage.UpdateCategory(category);
            }

            updatedCategories.Add(new CategoryDto
            {
                Id = category.Id,
                Name = category.Name,
                Color = category.Color,
                Icon = category.Icon,
                Type = category.Type ?? "Expense",
                MerchantAliases = category.MerchantAliases ?? new List<string>()
            });
        }

        return Task.FromResult(updatedCategories);
    }
}

