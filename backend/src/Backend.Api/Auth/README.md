# Auth

`SessionAuthentication.cs`: reads `Authorization: Bearer <token>`, validates it via `SessionService`, sets `account_id` and `session_id` claims.
