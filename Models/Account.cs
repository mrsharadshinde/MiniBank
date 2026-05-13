namespace MiniBankWallet.Models;
using System.ComponentModel.DataAnnotations;
using Microsoft.Net.Http.Headers;

public class Account
{
    public int Id { get; set; }

    public string AccountNumber {get; set;} = string.Empty;
    public string OwnerName { get; set; } = string.Empty;
    public string MobileNumber {get; set;} = string.Empty;
    public string? Email  {get; set;}

    // account type : checking (current) or saving 
    public AccountType AccountType {get; set;} = AccountType.Checking;

    // Pending, Active , Suspended 
    public string Status {get; set;} = "Pending";
    public decimal Balance { get; set; }

    [ConcurrencyCheck]
    public Guid Version { get; set; } = Guid.NewGuid();
}