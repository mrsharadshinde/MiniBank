using Microsoft.EntityFrameworkCore;
using MiniBankWallet.Data;
using MiniBankWallet.Models;
using MiniBankWallet.Helpers;
namespace MiniBankWallet.Workers;
// Inheriting from BackgroundServices turn this class into an autonomous thread !
public class DailyInterestWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DailyInterestWorker> _logger;
    private readonly IConfiguration _config;

    public DailyInterestWorker(
        IServiceProvider serviceProvider,
        ILogger<DailyInterestWorker> logger,
        IConfiguration config)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _config = config;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Night Shift Worker started.");

        // The Infinite Loop: This keeps the Worker alive as long as server running
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CalculateAndDepositInterest();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "FATAL ERROR during interest calculation!");
            }

            // The worker sleeps for 30 seconds, then goes back to the top of the while loop
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }


    private async Task CalculateAndDepositInterest()
    {
        //1. Create a "Scope"
        // Because this, Worker lives forever, but the Database connection (DbCOntext) is meant to be 
        // short-lived, we must create a temporary scope to safely  open and close the db connection
        using var scope = _serviceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        //2. Find all Active Savings accounts
        var savingsAccounts = await db.Accounts
            .Where(a => a.AccountType == AccountType.Saving && a.Status == "Active")
            .ToListAsync();

        if (savingsAccounts.Count == 0) return;


        int reserveAccountId = _config.GetValue<int>("BankSettings:CentralReserveAccountId");
        decimal apy = _config.GetValue<decimal>("BankSettings:DailyInterestApy");

        // 2. THE DEFENSIVE SAFEGUARD (Do not skip this!)
        if (reserveAccountId == 0)
        {
            _logger.LogError("CRITICAL: Reserve Account ID is 0. Typo in appsettings.json?");
            return; // Stop the code here so the database doesn't crash!
        }

        if (apy == 0)
        {
            _logger.LogWarning("WARNING: APY is 0. No interest will be calculated.");
            return;
        }
        
        _logger.LogInformation($"Calculating interest for {savingsAccounts.Count} Savings accounts...");

        // 4% APY = 0.04. Daily rate = 0.04 / 365
        decimal dailyInterestRate = apy / 365m;

        foreach (var account in savingsAccounts)
        {
            // Calculate today's interest (rounded to 2 decimal palces)
            decimal interestEarned = Math.Round(account.Balance * dailyInterestRate, 2);

            // Only process if they actully earned at least 1 penny 
            if (interestEarned >= 0.01m)
            {
                //1 Add the money
                account.Balance += interestEarned;
                account.Version = Guid.NewGuid();

                // uPDATE THE bank BALANCE 
                var ReserveAccount = await db.Accounts.FindAsync(reserveAccountId);
                if (ReserveAccount != null)
                {
                    ReserveAccount.Balance -= interestEarned;
                }

                //2. create the system receipt
                var record = new TransactionRecord
                {
                    FromAccountId = reserveAccountId, // In a real bank, this would be a special Bank Reserve Account ID
                    ToAccountId = account.Id,
                    Amount = interestEarned,
                    // No idempotencyKey key needed here since it's an internal system aciton 

                };

                db.TransactionRecords.Add(record);

                // Double Entry 
                // 4 . THE HELPER (Create both Debit and Credit perfectly)
                var ledgerLines = LedgerHelper.CreateDoubleEntry(
                    record: record,
                    senderAccountId :reserveAccountId,
                    receiverAccountId: account.Id,
                    amount: interestEarned,
                    debitDescription: $"Interest Payout to Account{account.AccountNumber}",
                    creditDescription: "Daily 4% APY Interest Accrual"
                );

                db.LedgerEntries.AddRange(ledgerLines);
                
            }
        }
        // save all changes in one massive transaction
        await db.SaveChangesAsync();
        _logger.LogInformation("interest calculation complete.");
    }
}