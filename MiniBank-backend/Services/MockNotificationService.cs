using MiniBankWallet.Services.interfaces;

namespace MiniBankWallet.Services;

public class MockNotificationService : INotificationService
{
    private readonly ILogger<MockNotificationService> _logger;

    public MockNotificationService(ILogger<MockNotificationService> logger)
    {
        _logger = logger;
    }

    public Task<bool> SendEmailAsync(string toEmail, string subject, string message)
    {
        // 1. Log a massive, easy-to-read block in your terminal
        _logger.LogInformation(
            "\n================ MOCK EMAIL ================\n" +
            "TO:      {Email}\n" +
            "SUBJECT: {Subject}\n" +
            "MESSAGE: {Message}\n" +
            "============================================\n", 
            toEmail, subject, message);

        // 2. Return a completed task so Hangfire thinks it succeeded
        return Task.FromResult(true);
    }

    public Task<bool> SendSmsAsync(string toNumber, string message)
    {
        // 1. Log a massive, easy-to-read block in your terminal
        _logger.LogInformation(
            "\n================ MOCK SMS ==================\n" +
            "TO:      {Number}\n" +
            "MESSAGE: {Message}\n" +
            "============================================\n", 
            toNumber, message);

        // 2. Return a completed task so Hangfire thinks it succeeded
       return Task.FromResult(true);
    }
}