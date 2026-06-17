using System;

namespace MiniBankWallet.Models.Governance;

public class ApprovalRequest
{
    public int Id { get; set; }
    
    // Maker Details 
    public int MakerUserId { get; set; }
    public string MakerName { get; set; } = string.Empty;

    // Transaction Details 
    public int FromAccountId { get; set; }
    public int ToAccountId { get; set; }
    public decimal Amount { get; set; }

    // Status details 
    public string Status { get; set; } = "Pending";
    public string Remark { get; set; } = "Amount limit exceeded."; 
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Checker details 
    public int? CheckerUserId { get; set; }
    public DateTime? ReviewedAt { get; set; }
}