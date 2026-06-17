using Twilio;
using Twilio.Rest.Api.V2010.Account;
using Twilio.Types;
using SendGrid;
using SendGrid.Helpers.Mail;
using MiniBankWallet.Services.interfaces;

namespace MiniBankWallet.Services;

public class BankNotificationService : INotificationService
{
    private readonly IConfiguration _config;
    private readonly ILogger<BankNotificationService> _logger;

    public BankNotificationService(IConfiguration config, ILogger<BankNotificationService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task<bool> SendSmsAsync(string toPhoneNumber, string message)
    {
        try
        {
            var accountSid = _config["Twilio:AccountSid"];
            var authToken = _config["Twilio:AuthToken"];
            var fromNumber = _config["Twilio:FromNumber"];

            // If keys are missing, gracefully fail so the API doesn't crash
            if (string.IsNullOrEmpty(accountSid) || string.IsNullOrEmpty(authToken))
            {
                _logger.LogWarning("Twilio credentials missing. SMS not sent.");
                return false;
            }

            TwilioClient.Init(accountSid, authToken);

            var messageResource = await MessageResource.CreateAsync(
                body: message,
                from: new PhoneNumber(fromNumber),
                to: new PhoneNumber(toPhoneNumber)
            );

            _logger.LogInformation($"SMS sent successfully to {toPhoneNumber}. SID: {messageResource.Sid}");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Failed to send SMS to {toPhoneNumber}: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> SendEmailAsync(string toEmail, string subject, string body)
    {
        try
        {
            var apiKey = _config["SendGrid:ApiKey"];
            var fromEmail = _config["SendGrid:FromEmail"];
            var fromName = _config["SendGrid:FromName"] ?? "MiniBank Security";

            if (string.IsNullOrEmpty(apiKey))
            {
                _logger.LogWarning("SendGrid credentials missing. Email not sent.");
                return false;
            }

            var client = new SendGridClient(apiKey);
            var from = new EmailAddress(fromEmail, fromName);
            var to = new EmailAddress(toEmail);
            
            var msg = MailHelper.CreateSingleEmail(from, to, subject, body, body);
            var response = await client.SendEmailAsync(msg);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation($"Email sent successfully to {toEmail}");
                return true;
            }

            _logger.LogWarning($"SendGrid returned status code: {response.StatusCode}");
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Failed to send email to {toEmail}: {ex.Message}");
            return false;
        }
    }
}