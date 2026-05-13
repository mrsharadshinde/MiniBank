using Microsoft.EntityFrameworkCore;
using MiniBankWallet.Models;

namespace MiniBankWallet.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<TransactionRecord> TransactionRecords => Set<TransactionRecord>();
   public DbSet<LedgerEntry> LedgerEntries => Set<LedgerEntry>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // FINTECH RULE #2: Lock down database precision to prevent floating-point errors
        modelBuilder.Entity<Account>()
            .Property(a => a.Balance)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<TransactionRecord>()
            .Property(t => t.Amount)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Account>()
            .Property(a => a.AccountType)
            .HasConversion<string>();
    }
}