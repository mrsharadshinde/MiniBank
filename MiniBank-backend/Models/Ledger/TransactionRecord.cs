namespace MiniBankWallet.Models.Ledger;

using MiniBankWallet.Models.Banking;

public class TransactionRecord
{
    public int Id { get; set; }
    public int FromAccountId { get; set; }
    public int ToAccountId { get; set; }
    public BankAccount? FromAccount { get; set; }
    public BankAccount? ToAccount { get; set; }
    // FINTECH RULE #1: Always use decimal for currency.
    public decimal Amount { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    // effective date 
    public DateTime? EffectiveDate { get; set; }
    // idempotency tracking
    public string? IdempotencyKey { get; set; }
}