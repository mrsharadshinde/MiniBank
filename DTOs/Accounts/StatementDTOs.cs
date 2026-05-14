namespace MiniBankWallet.DTOs.Accounts;

// signle line item 
public record class StatementLineItem
(
    int TransactionId,
    string Type, // "DEBIT" , "Credit"
    decimal Amount, 
    string Description,
    DateTime Date
);

public record PaginationMetadata(
    int CurrentPage,
    int Pagesize,
    int TotalRecords,
    int TotalPages 
);

// The Envelope (Includes the data AND THE pagination metadata)
public record StatementResponse(
    List<StatementLineItem> Data,
    PaginationMetadata Metadata
);
