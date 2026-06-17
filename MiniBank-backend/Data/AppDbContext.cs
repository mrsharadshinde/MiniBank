using Microsoft.EntityFrameworkCore;
using MiniBankWallet.Models.Ledger;
using MiniBankWallet.Models.Banking;
using MiniBankWallet.Models.Identity;
using MiniBankWallet.Models.Governance;
namespace MiniBankWallet.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<BankAccount> BankAccounts { get; set; }
    public DbSet<TransactionRecord> TransactionRecords => Set<TransactionRecord>();
    public DbSet<LedgerEntry> LedgerEntries => Set<LedgerEntry>();
    public DbSet<ApprovalRequest> ApprovalRequests { get; set; }

    public DbSet<AuditLog> AuditLogs { get; set; }

    public DbSet<BulkUploadBatch> bulkUploadBatches { get; set; }
    public DbSet<BulkUploadRow> bulkUploadRows { get; set; }
    public DbSet<SystemLog> SystemLogs { get; set; }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // FINTECH RULE #2: Lock down database precision to prevent floating-point errors
        modelBuilder.Entity<BankAccount>()
            .Property(a => a.Balance)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<TransactionRecord>()
            .Property(t => t.Amount)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<TransactionRecord>()
        .HasOne(t => t.FromAccount)
        .WithMany()
        .HasForeignKey(t => t.FromAccountId)
        .OnDelete(DeleteBehavior.Restrict); // Tells SQL Server NOT to cascade delete

        modelBuilder.Entity<TransactionRecord>()
            .HasOne(t => t.ToAccount)
            .WithMany()
            .HasForeignKey(t => t.ToAccountId)
            .OnDelete(DeleteBehavior.Restrict); // Tells SQL Server NOT to cascade delete

        modelBuilder.Entity<TransactionRecord>()   // Unique Idempotency key
            .HasIndex(t => t.IdempotencyKey)
            .IsUnique();

        modelBuilder.Entity<LedgerEntry>()
            .Property(l => l.Amount)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<BankAccount>()
            .Property(a => a.AccountType)
            .HasConversion<string>();

        modelBuilder.Entity<ApprovalRequest>()
    .Property(a => a.Amount)
    .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<BulkUploadRow>()
            .Property(r => r.Amount)
            .HasColumnType("decimal(18,2)");
    }
}