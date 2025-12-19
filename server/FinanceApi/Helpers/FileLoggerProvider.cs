using Microsoft.Extensions.Logging;
using System;
using System.IO;

namespace FinanceApi.Helpers;

/// <summary>
/// Simple file logger provider that writes logs to a file
/// </summary>
public class FileLoggerProvider : ILoggerProvider
{
    private readonly string _logFilePath;
    private readonly StreamWriter _writer;
    private readonly object _lock = new object();

    public FileLoggerProvider(string logFilePath)
    {
        _logFilePath = logFilePath;
        var directory = Path.GetDirectoryName(logFilePath);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }
        var fileStream = new FileStream(logFilePath, FileMode.Append, FileAccess.Write, FileShare.ReadWrite);
        _writer = new StreamWriter(fileStream)
        {
            AutoFlush = true
        };
    }

    public ILogger CreateLogger(string categoryName)
    {
        return new FileLogger(categoryName, _writer, _lock);
    }

    public void Dispose()
    {
        _writer?.Dispose();
    }

    private class FileLogger : ILogger
    {
        private readonly string _categoryName;
        private readonly StreamWriter _writer;
        private readonly object _lock;

        public FileLogger(string categoryName, StreamWriter writer, object lockObject)
        {
            _categoryName = categoryName;
            _writer = writer;
            _lock = lockObject;
        }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel)
        {
            return logLevel >= LogLevel.Information;
        }

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel))
                return;

            var message = formatter(state, exception);
            var timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            var logLevelString = logLevel.ToString().ToUpper().PadRight(5);
            var logMessage = $"[{timestamp}] [{logLevelString}] [{_categoryName}] {message}";

            if (exception != null)
            {
                logMessage += $"\n{exception}";
            }

            lock (_lock)
            {
                _writer.WriteLine(logMessage);
            }
        }
    }
}

