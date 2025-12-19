using System.Text.Json;
using Npgsql;

Console.WriteLine("DB apply tool starting...");

string GetPathFromArgOrDefault(string? arg, string fallback)
{
    if (!string.IsNullOrEmpty(arg) && File.Exists(arg)) return Path.GetFullPath(arg);
    return Path.GetFullPath(fallback);
}

var appSettingsPath = GetPathFromArgOrDefault(args.Length > 0 ? args[0] : null,
    Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "server", "FinanceApi", "appsettings.json"));

if (!File.Exists(appSettingsPath))
{
    Console.Error.WriteLine($"appsettings.json not found at {appSettingsPath}");
    return 1;
}

Console.WriteLine($"Using appsettings: {appSettingsPath}");
var appJson = File.ReadAllText(appSettingsPath);
using var doc = JsonDocument.Parse(appJson);
if (!doc.RootElement.TryGetProperty("ConnectionStrings", out var cs) || !cs.TryGetProperty("DefaultConnection", out var defaultConn))
{
    Console.Error.WriteLine("ConnectionStrings:DefaultConnection not found in appsettings.json");
    return 1;
}

var connectionString = defaultConn.GetString();
if (string.IsNullOrEmpty(connectionString))
{
    Console.Error.WriteLine("Empty connection string");
    return 1;
}

if (args.Length > 0 && args[0] == "check")
{
    Console.WriteLine("Checking DB for 'users' table and search_path...");
    try
    {
        using var conn = new NpgsqlConnection(connectionString);
        conn.Open();

        // Check search_path
        using var cmdPath = new NpgsqlCommand("SHOW search_path;", conn);
        var searchPath = (string?)cmdPath.ExecuteScalar();
        Console.WriteLine($"search_path: {searchPath}");

        // Check information_schema for users
        using var cmdInfo = new NpgsqlCommand("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'users'", conn);
        using var reader = cmdInfo.ExecuteReader();
        var found = false;
        while (reader.Read())
        {
            Console.WriteLine($"found: schema={reader.GetString(0)}, table={reader.GetString(1)}");
            found = true;
        }
        if (!found) Console.WriteLine("users table not found in information_schema");

        // Try SELECT count from finance.users and from users
        try
        {
            using var c1 = new NpgsqlCommand("SELECT COUNT(*) FROM finance.users", conn);
            var c1v = c1.ExecuteScalar();
            Console.WriteLine($"finance.users count: {c1v}");
        }
        catch (Exception e)
        {
            Console.WriteLine($"finance.users select failed: {e.Message}");
        }

        try
        {
            using var c2 = new NpgsqlCommand("SELECT COUNT(*) FROM users", conn);
            var c2v = c2.ExecuteScalar();
            Console.WriteLine($"users count: {c2v}");
        }
        catch (Exception e)
        {
            Console.WriteLine($"users select failed: {e.Message}");
        }

        return 0;
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine("Error checking DB:");
        Console.Error.WriteLine(ex.ToString());
        return 2;
    }
}

var sqlPath = GetPathFromArgOrDefault(args.Length > 1 ? args[1] : null,
    Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "server", "FinanceApi", "Database", "01_schema_simple.sql"));

if (!File.Exists(sqlPath))
{
    Console.Error.WriteLine($"SQL file not found at {sqlPath}");
    return 1;
}

Console.WriteLine($"Using SQL file: {sqlPath}");
var sql = File.ReadAllText(sqlPath);

try
{
    Console.WriteLine("Connecting to DB...");
    using var conn = new NpgsqlConnection(connectionString);
    conn.Open();
    Console.WriteLine("Connected. Executing SQL (may take a few seconds)...");
    using var cmd = new NpgsqlCommand(sql, conn) { CommandTimeout = 600 };
    var rows = cmd.ExecuteNonQuery();
    Console.WriteLine("SQL executed successfully.");
    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine("Error executing SQL:");
    Console.Error.WriteLine(ex.ToString());
    return 2;
}