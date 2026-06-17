using System.Text.RegularExpressions;
using ClosedXML.Excel;
using MiniBankWallet.DTOs.Transfers;
namespace MiniBankWallet.Services;

public class ExcelProcessingService
{
    // Regex pattern looking for dates like : 15-Jan-2026 or 05-May-2026
    private static readonly Regex DateRegex = new Regex(@"\b\d{2}-[A-Za-z]{3}-\d{4}\b", RegexOptions.Compiled);
    public List<BulkTransferItem> ParsePayrollExcel(Stream excelStream)
    {

        var transfers = new List<BulkTransferItem>();

        //1. Open the Excel file from the memory stream 
        using var workbook = new XLWorkbook(excelStream);

        //2 grab the very firs sheet in the file 
        var worksheet = workbook.Worksheet(1);

        //3 Get all the rows that actlly have data, but skip the Header row (Row 1)
        var rows = worksheet.RangeUsed().RowsUsed().Skip(1);

        foreach(var row in rows)
        {
            // Column 1: Account Nubmer (Read as string )
            string accountNo = row.Cell(1).GetString().Trim();

            //Column 2: Amount (Read as decimal )
            bool isAmountValid = row.Cell(3).TryGetValue<decimal>(out decimal amount);

            // column 3: Description 
            string Description = row.Cell(4).GetString().Trim();

            // Condition 1: Basic structural check
            if (string.IsNullOrWhiteSpace(accountNo) || !isAmountValid || amount <= 0) continue;

            // Condtion 2: Deep Extracction via regualr expression 
            DateTime? recordDate = null;
            var match = DateRegex.Match(Description);

            if(match.Success && DateTime.TryParse(match.Value, out DateTime parsedDate))
            {
                recordDate = parsedDate;
            }

            transfers.Add(new BulkTransferItem(accountNo, amount, Description, recordDate));
        }

        return transfers;
    }
}
