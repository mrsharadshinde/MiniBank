
namespace MiniBankWallet.Services;

public interface IBulkProcessingService
{
    // 🔥 Takes a string filePath, returns a standard Task
    Task ProcessPayrollBatchAsync(
        int batchId,
        string filePath, 
        string originalFileName,
        string fromAccountNumber, 
        DateTime quarterlyCutoff, 
        int loggedInUserId, 
        bool isStaff);
}