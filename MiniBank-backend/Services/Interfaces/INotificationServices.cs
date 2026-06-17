namespace MiniBankWallet.Services.interfaces;

public interface INotificationService
{
    Task<bool> SendSmsAsync(string toPhoneNumber, string message);
    Task<bool> SendEmailAsync(string toEmail, string subject, string body);
}