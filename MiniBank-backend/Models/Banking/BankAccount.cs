
using System.ComponentModel.DataAnnotations;
using MiniBankWallet.Models.Identity;

namespace MiniBankWallet.Models.Banking;

public class BankAccount
{
    public int Id {get; set;}

    // financial data
    public string AccountNumber {get;set;} = string.Empty;
    public decimal  Balance {get;set;}

    public AccountType AccountType {get;set;} = AccountType.Checking;
    public string Status {get;set;} = "Pending";

    // 2. Add the Version property to handle concurrency (prevent double-spending)
    [ConcurrencyCheck]
    public Guid Version { get; set; } = Guid.NewGuid();
    //Foreign keu: who ownd this account 
    public int UserId {get; set;}
    public User User {get; set;} = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow; 
    public DateTime UpdatedAt {get;set;} = DateTime.UtcNow;
}
