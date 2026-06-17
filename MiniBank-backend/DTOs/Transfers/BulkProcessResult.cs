namespace MiniBankWallet.DTOs.Transfers;

public class BulkProcessResult
{
    public bool IsSuccess { get; set; }
    public string? ErrorMessage { get; set; }
    public int SuccessCount { get; set; }
    public int SkippedCount { get; set; }
    public int BatchId { get; set; }

    public List<string> ValidationErrors { get; set; } = new();

        // 🔥 Holds the physical file data
    public byte[]? ErrorReportFile { get; set; }
}