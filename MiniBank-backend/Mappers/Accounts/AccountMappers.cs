using MiniBankWallet.DTOs.Accounts;
using MiniBankWallet.Models.Banking;

namespace MiniBankWallet.Mappers;

public static class Accountmappers
{
    public static AccountResponse ToAccountResponse(this BankAccount accountModel)
    {
        return new AccountResponse(
            accountModel.AccountNumber,
            accountModel.User.OwnerName,
            accountModel.User.Email,
            accountModel.AccountType.ToString(),
            accountModel.Balance,
            accountModel.Status
        );
    }
}

