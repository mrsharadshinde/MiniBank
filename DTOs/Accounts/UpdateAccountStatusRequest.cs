namespace MiniBankWallet.DTOs.Accounts;

// We use this instead of "Delete"
public record UpdateAccountStatusRequest(string NewStatus, string ReasonForChange);