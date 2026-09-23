# Accounts

| File | Purpose |
|------|---------|
| `AccountService.cs` | Login (validate upstream → upsert account → default profile). Returns decrypted `ProviderContext` for server-side calls. |
| `SessionService.cs` | Create / validate / revoke bearer tokens (stored as SHA-256). |
| `ProfileService.cs` | Profile CRUD with name uniqueness and limit (5). |
| `ProgressService.cs` | Watch progress upsert/list/delete per profile (ownership checked). |
