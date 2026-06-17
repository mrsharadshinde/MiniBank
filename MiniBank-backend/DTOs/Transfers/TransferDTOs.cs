namespace MiniBankWallet.DTOs.Transfers;

public record TransferRequest(
    string FromAccountNumber,
    string ToAccountNumber,
    decimal Amount
);

// THe receipt we send back
public record TransferResponse(
    int TransactionId, 
    string Message, 
    DateTime Timestamp
);

// for the Excel file will just have two  colums: Account Number and Amount 
public record BulkTransferItem(
    string ToAccountNumber,
    Decimal Amount,
    string Description,
    DateTime ? ExtractedDate);
    
