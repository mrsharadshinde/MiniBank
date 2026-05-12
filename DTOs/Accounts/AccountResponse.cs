namespace MiniBankWallet.DTOs.Accounts;

// This is what we send BACK to the user. We never send the raw EF Core Model.
public record AccountResponse(int Id, string OwnerName, decimal Balance);