namespace MiniBankWallet.Models.Governance;

public class AuditLog
{
    public int Id {get;set;}

    public int PerformedByUserId {get;set;} // the stff member 
    public string PerformedByRole {get;set;} = string.Empty; // "Admin" or "Teller"

    public int TargetUserId {get;set;} // customer whose data was changed 
    public string Action {get;set;} = string.Empty; // "Updated Mobile Number"

    public string OldValue {get;set;} = string.Empty;
    public string NewValue {get;set;} = string.Empty;

    public DateTime Timestamp {get;set;} = DateTime.UtcNow;


}