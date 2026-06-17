using MiniBankWallet.Models.Ledger;
namespace MiniBankWallet.Helpers;

public class LedgerHelper
{
    // this tools takes the raw data and perfectly genreated the balance debit and creadit data 
    public static List<LedgerEntry> CreateDoubleEntry(
        TransactionRecord record,
        int senderAccountId,
        int receiverAccountId,
        decimal amount,
        string debitDescription,
        string creditDescription)
        {
            return new List<LedgerEntry>
            {
               //1 . The Debit 
               new LedgerEntry
               {
                   Transaction = record,
                   AccountId = senderAccountId,
                   Amount = -amount,
                   Description = debitDescription
               },

                // 2. The Credit 
               new LedgerEntry
               {
                   Transaction = record,
                   AccountId = receiverAccountId,
                   Amount = Math.Abs(amount),
                   Description = creditDescription
               }
            };
        }
}
