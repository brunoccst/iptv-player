namespace Backend.Core.Accounts;

/// <summary>Encrypts provider passwords at rest.</summary>
public interface ICredentialProtector
{
    string Protect(string plaintext);

    string Unprotect(string ciphertext);
}
