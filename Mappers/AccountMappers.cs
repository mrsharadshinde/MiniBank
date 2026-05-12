using MiniBankWallet.Models;
using MiniBankWallet.DTOs.Accounts;

namespace MiniBankWallet.Mappers;

public static class Accountmappers
{
    public static AccountResponse ToAccountResponse(this Account accountModel)
    {
        return new AccountResponse(
            accountModel.Id,
            accountModel.OwnerName,
            accountModel.Balance
        );
    }
}