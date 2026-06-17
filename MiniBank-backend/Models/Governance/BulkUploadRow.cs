namespace MiniBankWallet.Models.Governance;

public class BulkUploadRow
{
    public int id {get;set;}

    // Foregin key for batch
    public BulkUploadBatch? BulkUploadBatch {get;set;}

    public string TargetAccountNumber {get;set;} = string.Empty;
    public Decimal Amount {get;set;} 
    public string Description {get;set;}  = string.Empty;

    public string Quarter {get;set;} = string.Empty;
    public string Flag {get;set;} = string.Empty;

    public DateTime? RecordDate {get;set;}
    public DateTime? ProcessedDate {get;set;}

}