# src

Production projects. Dependency direction: `Api → Infrastructure → Core`.

| Project | Purpose |
|---------|---------|
| `Backend.Api` | ASP.NET Core host. |
| `Backend.Core` | Domain models, provider interfaces, configuration. |
| `Backend.Infrastructure` | Implementations: Xtream provider, persistence, security, services. |
