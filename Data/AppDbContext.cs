using Microsoft.EntityFrameworkCore;
using MiniBankWallet.Models;
using MiniBankWallet.Models.Banking;
using MiniBankWallet.Models.Identity;

namespace MiniBankWallet.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users {get;set;}
    public DbSet<BankAccount> BankAccounts {get;set;}
    public DbSet<TransactionRecord> TransactionRecords => Set<TransactionRecord>();
   public DbSet<LedgerEntry> LedgerEntries => Set<LedgerEntry>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // FINTECH RULE #2: Lock down database precision to prevent floating-point errors
        modelBuilder.Entity<BankAccount>()
            .Property(a => a.Balance)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<TransactionRecord>()
            .Property(t => t.Amount)
            .HasColumnType("decimal(18,2)");
            
        modelBuilder.Entity<LedgerEntry>()
            .Property(l => l.Amount)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<BankAccount>()
            .Property(a => a.AccountType)
            .HasConversion<string>();
    }
}