using FluentValidation;
using MiniBankWallet.DTOs.Accounts;
using MiniBankWallet.Models;

namespace MiniBankWallet.Validators;

public class CreateAccountRequestValidator: AbstractValidator<CreateAccountRequest>
{
    public CreateAccountRequestValidator()
    {
        // Tells FluentValidation: "If the first rules fails, stop checking. Don't rune 
        ClassLevelCascadeMode = CascadeMode.Stop;

        //1. Name Rules 
        RuleFor(x => x.OwnerName)
            .NotEmpty().WithMessage("Owner Name is required.")
            .MinimumLength(2).WithMessage("Must be atlest 2 charectors long")
            .MaximumLength(50).WithMessage("Name cannot exceed 50 charectors") ;
        
        // 2. Mobile number rules 
       RuleFor(x => x.MobileNumber)
            .NotEmpty().WithMessage("Mobile number is requered.")
            .Must(number =>
            {
                if (string.IsNullOrWhiteSpace(number)) return false;
                var cleanNumber = number.Trim();
                return System.Text.RegularExpressions.Regex.IsMatch(cleanNumber, @"^\d{10}$");
            })
            .WithMessage("Mobile Number must be exactly 10 digit.") ; 

        // 3. Email Rules 
        RuleFor(x => x.Email)
            .Matches(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")
            .WithMessage("Please enter a valid email address (e.g., name@example.com).")
            .When(x => !string.IsNullOrWhiteSpace(x.Email)); 

        // 4. Accout type rules 
        RuleFor(x => x.AccountType)
            .NotEmpty().WithMessage("Account type is requered.")
            .IsEnumName(typeof(AccountType), caseSensitive: false)
            .WithMessage($"Account type must be one of: {string.Join(", ", Enum.GetNames(typeof(AccountType)))}");
    }
}
