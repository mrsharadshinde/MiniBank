namespace MiniBankWallet.DTOs.Transfers;

public record TransferRequest(int FromAccountId, int ToAccountId, decimal Amount);