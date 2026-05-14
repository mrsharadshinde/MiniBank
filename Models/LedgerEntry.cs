using System;

namespace MiniBankWallet.Models;

public class LedgerEntry
{
    public int Id {get; set;}

    // link main Transaction recoed 
    public int TransactionId {get; set;}
    public TransactionRecord Transaction {get; set;} = null!;

    // The account this specific line affests 
    public int AccountId  {get; set;}
    public Account Account {get; set;} = null!;

    public decimal Amount {get; set;}

    public string Description {get; set;} = string.Empty;
    public DateTime CreatedAt {get; set;} = DateTime.UtcNow;

}
