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

    // Role data
    public UserRole Role {get; set;} = UserRole.Customer;
    
    // ==========================================
    //  Security & Provisioning Data

    public string PasswordHash { get; set; } = string.Empty; 
    public bool RequiresPasswordReset { get; set; } = false; 
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow; 
    public int? CreatedByAdminId { get; set; } // Nullable because customers don't have an admin creator

    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }
    public List<BankAccount> BankAccounts {get; set;} = new();
}