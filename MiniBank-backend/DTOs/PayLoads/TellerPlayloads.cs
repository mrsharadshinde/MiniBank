namespace MiniBankWallet.DTOs.PayLoads;

public class StaffLoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class ChangePasswordRequest
{
    public string Email { get; set; } = string.Empty;
    public string OldTempPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public record CashTransactionRequest(string AccountNumber, decimal Amount, string Description);