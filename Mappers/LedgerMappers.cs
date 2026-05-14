using MiniBankWallet.Models;
using MiniBankWallet.DTOs.Accounts;
namespace MiniBankWallet.Mappers;

public static class LedgerMappers
{
    public static IQueryable<StatementLineItem> MapToStatementDTO(this IQueryable<LedgerEntry> query)
    {
        return query.Select(l => new StatementLineItem(
            l.TransactionId,
            l.Amount < 0 ? "DEBIT" : "CREDIT",
            Math.Abs(l.Amount),
            l.Description,
            l.CreatedAt
        ));
    }
}
