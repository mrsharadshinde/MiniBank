namespace MiniBankWallet.DTOs.Accounts;

public record AccountLookupResponse(
    int UserId,
    string OwnerName,
    string Email,
    string MobileNumber,
    string? MatchedAccountNumber,
    List<AccountLookupAccount> Accounts
);

public record AccountLookupAccount(
    string AccountNumber,
    string AccountType,
    string Status,
    decimal Balance
);