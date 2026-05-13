namespace MiniBankWallet.DTOs.Transfers;

public record TransferRequest(
    string FromAccountNumber,
    string ToAccountNumber,
    decimal Amount
);

// THe receipt we send back
