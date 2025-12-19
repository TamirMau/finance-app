using System.IO;

namespace FinanceApi.Services;

/// <summary>
/// Helper service that cleans up old log files (older than 3 days)
/// Called on successful login to prevent log files from accumulating
/// </summary>
public static class LogCleanupService
{
    private const int RetentionDays = 3; // Keep logs for 3 days

    /// <summary>
    /// Cleans up old log files from the specified directory
    /// </summary>
    /// <param name="logDirectory">Path to the logs directory</param>
    /// <param name="logger">Logger instance for logging cleanup operations</param>
    public static void CleanupOldLogs(string logDirectory, ILogger logger)
    {
        try
        {
            if (!Directory.Exists(logDirectory))
            {
                return;
            }

            var cutoffDate = DateTime.Now.AddDays(-RetentionDays);
            var logFiles = Directory.GetFiles(logDirectory, "*.log");

            var deletedCount = 0;
            var totalSizeFreed = 0L;

            foreach (var logFile in logFiles)
            {
                try
                {
                    var fileInfo = new FileInfo(logFile);
                    
                    // Check if file is older than retention period
                    if (fileInfo.LastWriteTime < cutoffDate)
                    {
                        var fileSize = fileInfo.Length;
                        File.Delete(logFile);
                        deletedCount++;
                        totalSizeFreed += fileSize;
                        
                        logger.LogInformation(
                            "LogCleanupService: Deleted old log file: {FileName}, Age: {Age} days, Size: {Size} bytes",
                            fileInfo.Name,
                            (DateTime.Now - fileInfo.LastWriteTime).Days,
                            fileSize);
                    }
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "LogCleanupService: Failed to delete log file: {FileName}", logFile);
                }
            }

            if (deletedCount > 0)
            {
                logger.LogInformation(
                    "LogCleanupService: Cleanup completed. Deleted {Count} files, Freed {Size} bytes ({SizeMB} MB)",
                    deletedCount,
                    totalSizeFreed,
                    totalSizeFreed / (1024.0 * 1024.0));
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "LogCleanupService: Error during log cleanup");
        }
    }
}

