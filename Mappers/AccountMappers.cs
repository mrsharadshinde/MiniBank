using MiniBankWallet.Models;
using MiniBankWallet.DTOs.Accounts;

namespace MiniBankWallet.Mappers;

public static class Accountmappers
{
    public static AccountResponse ToAccountResponse(this Account accountModel)
    {
        return new AccountResponse(
            accountModel.AccountNumber,
            accountModel.OwnerName,
            accountModel.Status,
            accountModel.Balance
        );
    }
}

