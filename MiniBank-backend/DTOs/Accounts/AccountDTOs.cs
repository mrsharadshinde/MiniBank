namespace MiniBankWallet.DTOs.Accounts;

// WHAT THE USER SENDS US TO OPEN AN ACCOUNT
public record CreateAccountRequest(
    string OwnerName, 
    string AadharNumber,
    string MobileNumber, 
    string? Email, // Optional
    string AccountType, // keeping as string for json parsing 
    string KycToken
);

// WHAT THE USER SENDS US TO UPDATE THEIR PROFILE
public record UpdateContactRequest(
    string? NewEmail,
    string? NewMobile
    // Note: Banks rarely let you update your phone number via a simple API call 
    // without 2FA, so we only allow email updates for now!
);

// WHAT WE SEND BACK TO THE USER (Safe Data Only)
public record AccountResponse(
    string AccountNumber, 
    string OwnerName, 
    string Email,
    string AccountType,
    decimal Balance,
    string Status
);

