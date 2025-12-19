using FinanceApi.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace FinanceApi.Data;

public class FinanceDbContext : DbContext
{
    public FinanceDbContext(DbContextOptions<FinanceDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Category> Categories { get; set; }
    public DbSet<Transaction> Transactions { get; set; }
    public DbSet<UserSettings> UserSettings { get; set; }
    public DbSet<BankStatement> BankStatements { get; set; }
    public DbSet<BankStatementRow> BankStatementRows { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Set default schema to 'finance' so unqualified table names map correctly
        modelBuilder.HasDefaultSchema("finance");

        // User configuration
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.Username).HasColumnName("username").IsRequired().HasMaxLength(100);
            entity.Property(e => e.Email).HasColumnName("email").IsRequired().HasMaxLength(255);
            entity.Property(e => e.PasswordHash).HasColumnName("password_hash").IsRequired();
            entity.Property(e => e.Salt).HasColumnName("salt").HasMaxLength(50);
            entity.Property(e => e.Role).HasColumnName("role").HasMaxLength(50).HasDefaultValue("User");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();

            // Indexes
            entity.HasIndex(e => e.Username).IsUnique();
            entity.HasIndex(e => e.Email).IsUnique();
        });

        // Category configuration
        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("categories");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired().HasMaxLength(200);
            entity.Property(e => e.Color).HasColumnName("color").HasMaxLength(20).HasDefaultValue("#2196F3");
            entity.Property(e => e.Icon).HasColumnName("icon").HasMaxLength(100);
            entity.Property(e => e.Type).HasColumnName("type").HasMaxLength(50).HasDefaultValue("Expense");
            
            // JSON column for MerchantAliases
            entity.Property(e => e.MerchantAliases)
                .HasColumnName("merchant_aliases")
                .HasColumnType("jsonb")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>());

            // Indexes
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.Name);
        });

        // Transaction configuration
        modelBuilder.Entity<Transaction>(entity =>
        {
            entity.ToTable("transactions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
            entity.Property(e => e.TransactionDate).HasColumnName("transaction_date").IsRequired();
            entity.Property(e => e.BillingDate).HasColumnName("billing_date").IsRequired();
            entity.Property(e => e.AssignedMonthDate).HasColumnName("assigned_month_date").IsRequired();
            entity.Property(e => e.Amount).HasColumnName("amount").HasColumnType("decimal(18,2)").IsRequired();
            entity.Property(e => e.CategoryId).HasColumnName("category_id").IsRequired();
            entity.Property(e => e.Type).HasColumnName("type").HasMaxLength(50).HasDefaultValue("Expense");
            entity.Property(e => e.MerchantName).HasColumnName("merchant_name").HasMaxLength(500);
            entity.Property(e => e.ReferenceNumber).HasColumnName("reference_number").HasMaxLength(100);
            entity.Property(e => e.CardNumber).HasColumnName("card_number").HasMaxLength(10);
            entity.Property(e => e.Currency).HasColumnName("currency").HasMaxLength(10).HasDefaultValue("ILS");
            entity.Property(e => e.Installments).HasColumnName("installments");
            entity.Property(e => e.Source).HasColumnName("source").HasMaxLength(200);
            entity.Property(e => e.Notes).HasColumnName("notes").HasColumnType("text");
            entity.Property(e => e.Branch).HasColumnName("branch").HasMaxLength(200);
            entity.Property(e => e.IsHalves).HasColumnName("is_halves").HasDefaultValue(false);

            // Foreign keys
            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne<Category>()
                .WithMany()
                .HasForeignKey(e => e.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            // Indexes for performance
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.AssignedMonthDate);
            entity.HasIndex(e => new { e.UserId, e.AssignedMonthDate });
            entity.HasIndex(e => e.CategoryId);
            entity.HasIndex(e => e.CardNumber);
            entity.HasIndex(e => new { e.UserId, e.AssignedMonthDate, e.CardNumber });
        });

        // UserSettings configuration
        modelBuilder.Entity<UserSettings>(entity =>
        {
            entity.ToTable("user_settings");
            entity.HasKey(e => e.UserId);
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.DateRangeType).HasColumnName("date_range_type").HasMaxLength(50).HasDefaultValue("month-start");
            entity.Property(e => e.SelectedMonth).HasColumnName("selected_month");
            entity.Property(e => e.ShowHalves).HasColumnName("show_halves").HasDefaultValue(false);
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").IsRequired();

            // Foreign key
            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // BankStatement configuration
        modelBuilder.Entity<BankStatement>(entity =>
        {
            entity.ToTable("bank_statements");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
            entity.Property(e => e.AccountNumber).HasColumnName("account_number").HasMaxLength(50).IsRequired();
            entity.Property(e => e.StatementDate).HasColumnName("statement_date").IsRequired();
            entity.Property(e => e.Balance).HasColumnName("balance").HasColumnType("decimal(18,2)");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").IsRequired();

            // Foreign key
            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Navigation property to Rows
            entity.HasMany(b => b.Rows)
                .WithOne(r => r.BankStatement)
                .HasForeignKey(r => r.BankStatementId)
                .OnDelete(DeleteBehavior.Cascade);

            // Index
            entity.HasIndex(e => e.UserId).IsUnique(); // One statement per user
        });

        // BankStatementRow configuration
        modelBuilder.Entity<BankStatementRow>(entity =>
        {
            entity.ToTable("bank_statement_rows");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.BankStatementId).HasColumnName("bank_statement_id").IsRequired();
            entity.Property(e => e.Balance).HasColumnName("balance").HasColumnType("decimal(18,2)");
            entity.Property(e => e.ValueDate).HasColumnName("value_date").IsRequired();
            entity.Property(e => e.Debit).HasColumnName("debit").HasColumnType("decimal(18,2)");
            entity.Property(e => e.Credit).HasColumnName("credit").HasColumnType("decimal(18,2)");
            entity.Property(e => e.Reference).HasColumnName("reference").HasMaxLength(100);
            entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(500);
            entity.Property(e => e.ActionType).HasColumnName("action_type").HasMaxLength(50);
            entity.Property(e => e.Date).HasColumnName("date").IsRequired();

            // Foreign key
            entity.HasOne(e => e.BankStatement)
                .WithMany(b => b.Rows)
                .HasForeignKey(e => e.BankStatementId)
                .OnDelete(DeleteBehavior.Cascade);

            // Ignore transient properties that are not present in the DB schema
            entity.Ignore(e => e.For);
            entity.Ignore(e => e.ForBenefitOf);

            // Index
            entity.HasIndex(e => e.BankStatementId);
        });
    }
}

