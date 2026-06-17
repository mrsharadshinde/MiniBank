using System;

namespace MiniBankWallet.Models.Governance;

public class SystemLog
{
    public int Id { get; set; }
    public string? UserId { get; set; } // Nullable because some requests (like login) happen before the user is authenticated
    public string Method { get; set; } = string.Empty; // GET, POST, etc.
    public string Path { get; set; } = string.Empty; // /api/transfers
    public int StatusCode { get; set; } // 200, 400, 403, 500
    public string? IpAddress { get; set; }
    public long ExecutionTimeMs { get; set; } // How fast is your API?
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}