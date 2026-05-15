using FluentValidation;
using MiniBankWallet.DTOs.Transfers;

namespace MiniBankWallet.Validators;

public class TransferRequestValidator: AbstractValidator<TransferRequest>
{
    public TransferRequestValidator()
    {
        //1. sender Account Rules 
        RuleFor(x => x.FromAccountNumber)
            .NotEmpty().WithMessage("Sender Account Number is Required ")
            .Matches(@"^\d{12}$").WithMessage("Invalid format. Account Number Must be exactly 12 digit.");

        //2. receiver Account rule 
        RuleFor(x => x.ToAccountNumber)
            .NotEmpty().WithMessage("Receiver Account Number is Required.")
            .Matches(@"^\d{12}$").WithMessage("Invalid format. Receiver Account Number must be exactly 12 digit")
            // comparing two fileds 
            .NotEqual(x => x.FromAccountNumber).WithMessage("You cannot transfer money in same account");

        // 3. Amount Rule 
        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("transfer amount must be greater than zero (0).")
            .Must(ammount => decimal.Round(ammount, 2) == ammount)
            .WithMessage("Transfer amount cannot have more than 2 decimal Please.");
    }
}
