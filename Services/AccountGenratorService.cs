using System;
using System.Net.Http.Headers;

namespace MiniBankWallet.Services;

public  static class AccountGenratorService
{
    public static string Generate12DigitAccountNumber()
    {
        var random = new Random();
        string branchCode = "1001";

        string sequence = random.Next(1000000, 9999999).ToString();

        // 3. Simple CheckSum (Last digit of the sequence sum to catch typeos)
        int sum = 0;
        foreach(char c in sequence)
        {
            sum += int.Parse(c.ToString());
        }

        string checkDigit = (sum % 10).ToString();

        // result : 1001 + 5928471 + 6 = 10015928476

        return $"{branchCode}{sequence}{checkDigit}";

    }
}
