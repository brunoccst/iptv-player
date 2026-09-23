using Backend.Core.Accounts;
using Microsoft.AspNetCore.DataProtection;

namespace Backend.Infrastructure.Security;

public sealed class DataProtectionCredentialProtector(IDataProtectionProvider provider) : ICredentialProtector
{
    private readonly IDataProtector _protector = provider.CreateProtector("ProviderCredentials.v1");

    public string Protect(string plaintext) => _protector.Protect(plaintext);

    public string Unprotect(string ciphertext) => _protector.Unprotect(ciphertext);
}
