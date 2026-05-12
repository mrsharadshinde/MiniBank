namespace MiniBankWallet.DTOs.Accounts;

// Notice we don't ask for an ID, because the database generates that!
public record CreateAccountRequest(string OwnerName, decimal InitialDeposit);