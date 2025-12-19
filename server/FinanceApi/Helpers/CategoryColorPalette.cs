namespace FinanceApi.Helpers;

public static class CategoryColorPalette
{
    // Soft, subtle color palette - gentle and elegant
    private static readonly string[] Colors = new[]
    {
        "#93C5FD", // Soft Blue
        "#86EFAC", // Soft Green
        "#FCD34D", // Soft Amber
        "#FCA5A5", // Soft Red
        "#C4B5FD", // Soft Purple
        "#F9A8D4", // Soft Pink
        "#7DD3FC", // Soft Cyan
        "#FDB68A", // Soft Orange
        "#BEF264", // Soft Lime
        "#5EEAD4", // Soft Teal
        "#A5B4FC", // Soft Indigo
        "#D8B4FE", // Soft Violet
        "#6EE7B7", // Soft Emerald
        "#FBCFE8", // Soft Rose
        "#60A5FA", // Soft Sky Blue
        "#94A3B8", // Soft Slate
        "#E9D5FF", // Soft Fuchsia
        "#34D399", // Soft Aqua Green
        "#FDE68A", // Soft Yellow
        "#A78BFA"  // Soft Lavender
    };

    /// <summary>
    /// Gets a color from the palette based on index, cycling through colors if needed
    /// </summary>
    public static string GetColor(int index)
    {
        if (index < 0)
            index = 0;
        
        return Colors[index % Colors.Length];
    }

    /// <summary>
    /// Gets the next available color that hasn't been used by existing categories
    /// </summary>
    public static string GetNextAvailableColor(List<string> usedColors)
    {
        // If no colors are used, return the first one
        if (usedColors == null || usedColors.Count == 0)
        {
            return Colors[0];
        }

        // Find the first color that isn't in the used colors list
        foreach (var color in Colors)
        {
            if (!usedColors.Contains(color, StringComparer.OrdinalIgnoreCase))
            {
                return color;
            }
        }

        // If all colors are used, cycle through based on count
        return GetColor(usedColors.Count);
    }

    /// <summary>
    /// Gets a color based on category name hash for consistent assignment
    /// </summary>
    public static string GetColorForName(string categoryName)
    {
        if (string.IsNullOrWhiteSpace(categoryName))
        {
            return Colors[0];
        }

        // Use hash of category name to get consistent color
        var hash = categoryName.GetHashCode();
        var index = Math.Abs(hash) % Colors.Length;
        return Colors[index];
    }
}

