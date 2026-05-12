using System.ComponentModel.DataAnnotations;
namespace MiniBankWallet.Models;

public class Account
{
    public int Id { get; set; }
    public string OwnerName { get; set; } = string.Empty;
    public decimal Balance { get; set; }

    [ConcurrencyCheck]
    public Guid Version { get; set; } = Guid.NewGuid();
}