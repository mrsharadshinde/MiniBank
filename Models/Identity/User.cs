using MiniBankWallet.Models.Banking;

namespace MiniBankWallet.Models.Identity;

public class User
{
    public int Id {get; set;}

    // Identity data
    public string OwnerName {get; set;} = string.Empty;
    public string AadharNumber {get;set;} = string.Empty;
    public string MobileNumber {get; set;} = string.Empty;
    public string Email {get; set;}  = string.Empty;

    // security data
    public UserRole Role {get; set;} = UserRole.Customer ;
    
    public List<BankAccount> BankAccounts {get; set;} = new();
}
