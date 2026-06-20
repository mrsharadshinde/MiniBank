using System.Security.Cryptography;
using System.Text;

namespace MiniBankWallet.Helpers;

public static class SecurityHelper
{
    private const string Uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private const string Lowercase = "abcdefghijklmnopqrstuvwxyz";
    private const string Digits = "0123456789";
    private const string SpecialCharacters = "!@#$%^&*()_-+=<>?";

    public static string GenerateRandomPassword(int length = 12)
    {
        if (length < 4)
            throw new ArgumentException("Password length must be at least 4 to meet complexity requirements.", nameof(length));

        var password = new StringBuilder();

        // 1. Guarantee at least one character from each category
        password.Append(GetRandomCharacter(Uppercase));
        password.Append(GetRandomCharacter(Lowercase));
        password.Append(GetRandomCharacter(Digits));
        password.Append(GetRandomCharacter(SpecialCharacters));

        // 2. Fill the rest of the requested length with a mix of all characters
        string allChars = Uppercase + Lowercase + Digits + SpecialCharacters;
        for (int i = 4; i < length; i++)
        {
            password.Append(GetRandomCharacter(allChars));
        }

        // 3. Shuffle the result so the first 4 characters aren't predictably Upper/Lower/Digit/Special
        return ShuffleString(password.ToString());
    }

    private static char GetRandomCharacter(string characterSet)
    {
        // 🔥 RandomNumberGenerator is cryptographically secure (unlike standard Random)
        int index = RandomNumberGenerator.GetInt32(characterSet.Length);
        return characterSet[index];
    }

    private static string ShuffleString(string str)
    {
        char[] array = str.ToCharArray();
        for (int i = array.Length - 1; i > 0; i--)
        {
            int j = RandomNumberGenerator.GetInt32(i + 1);
            // Swap
            (array[i], array[j]) = (array[j], array[i]); 
        }
        return new string(array);
    }

    /// for refresh token
    public static string GenerateRefreshToken()
    {
        var randomNumber = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }
}