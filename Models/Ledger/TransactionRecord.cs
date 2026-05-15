namespace MiniBankWallet.Models;

public class TransactionRecord
{
    public int Id { get; set; }
    public int FromAccountId { get; set; }
    public int ToAccountId { get; set; }

    // FINTECH RULE #1: Always use decimal for currency.
    public decimal Amount { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    // idempotency tracking
    public string? IdempotencyKey { get; set; }
}