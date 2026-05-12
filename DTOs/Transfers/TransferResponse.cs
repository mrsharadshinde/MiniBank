namespace MiniBankWallet.DTOs.Transfers;

public record TransferResponse(int ReceiptId, string Message, DateTime Timestamp);