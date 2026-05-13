namespace MiniBankWallet.DTOs.Transfers;

public record TransferResponse(
    int TransactionId, 
    string Message, 
    DateTime Timestamp
);