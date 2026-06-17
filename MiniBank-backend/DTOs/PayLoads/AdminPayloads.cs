using System.ComponentModel.DataAnnotations;

namespace MiniBankWallet.DTOs.PayLoads;

public record StaffProvisioningSendOtpRequest(
    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Invalid email format.")]
    string Email,

    [Required(ErrorMessage = "Mobile number is required.")]
    [RegularExpression(@"^[6-9]\d{9}$", ErrorMessage = "Mobile number must be a valid 10-digit Indian number starting with 6-9.")]
    string MobileNumber
);

public record StaffProvisioningVerifyOtpRequest(
    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Invalid email format.")]
    string Email,

    [Required(ErrorMessage = "Mobile number is required.")]
    [RegularExpression(@"^[6-9]\d{9}$", ErrorMessage = "Mobile number must be a valid 10-digit Indian number starting with 6-9.")]
    string MobileNumber,

    [Required(ErrorMessage = "Mobile OTP is required.")]
    [StringLength(6, MinimumLength = 6, ErrorMessage = "OTP must be 6 digits.")]
    string MobileOtp,

    [Required(ErrorMessage = "Email OTP is required.")]
    [StringLength(6, MinimumLength = 6, ErrorMessage = "OTP must be 6 digits.")]
    string EmailOtp
);

public record ProvisionStaffRequest(
    [Required(ErrorMessage = "Full name is required.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Full name must be between 2 and 100 characters.")]
    string FullName,

    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Invalid email format.")]
    string Email,

    [Required(ErrorMessage = "Aadhar number is required.")]
    [StringLength(12, MinimumLength = 12, ErrorMessage = "Aadhar number must be 12 digits.")]
    [RegularExpression(@"^\d{12}$", ErrorMessage = "Aadhar number must contain only digits.")]
    string AadharNumber,

    [Required(ErrorMessage = "Mobile number is required.")]
    [RegularExpression(@"^[6-9]\d{9}$", ErrorMessage = "Mobile number must be a valid 10-digit Indian number starting with 6-9.")]
    string MobileNumber,

    [Required(ErrorMessage = "Staff provisioning token is required.")]
    string StaffProvisioningToken
);

public record UpdateAccountStatusRequest(string NewStatus, string Remarks);


