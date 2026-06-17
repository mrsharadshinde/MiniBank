namespace MiniBankWallet.Models.Governance;

public class BulkUploadBatch
{
    public int Id {get;set;}
    public string FileName {get;set;} = string.Empty;
    public DateTime UploadDate {get;set;} = DateTime.UtcNow;
    public int UploadedByUserId {get;set;} 

    // Background Processing Tracking
    public string Status { get; set; } = "Pending"; // Pending, Completed, Failed
    public string? ErrorMessage { get; set; }
    public string? ErrorReportFilePath { get; set; }
    public string? IdempotencyKey {get;set;}
    
    // Links this Batch to all its rows
    public ICollection<BulkUploadRow> Rows {get;set;} = new List<BulkUploadRow>();
}