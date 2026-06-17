namespace MiniBankWallet.DTOs.Accounts;

public record KycSendOtpRequest(
    string MobileNumber,
    string Email
);

public record KycVerifyOtpRequest(
    string MobileNumber,
    string Email,
    string MobileOtp,
    string EmailOtp
);