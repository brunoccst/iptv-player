using System.ComponentModel.DataAnnotations;

namespace Backend.Core.Configuration;

/// <summary>Public app settings. Values come from the root <c>.env</c> keys named in <see cref="EnvKeys"/>.</summary>
public sealed class AppOptions
{
    public static class EnvKeys
    {
        public const string Name = "APP_NAME";
        public const string Slug = "APP_SLUG";
    }

    [Required(AllowEmptyStrings = false)]
    public string Name { get; set; } = string.Empty;

    [Required(AllowEmptyStrings = false)]
    public string Slug { get; set; } = string.Empty;
}
