# Mini-Bank Wallet API 🏦

A robust, enterprise-grade backend API simulating a core banking wallet system. Built with **.NET 8 Minimal APIs** and **Entity Framework Core**, this project demonstrates high-performance financial transactions with strict data integrity and security guards.

## 🚀 Enterprise Features
* **ACID Transactions:** Enforced all-or-nothing database commits using `.BeginTransactionAsync()` to ensure no money is lost during server crashes.
* **Optimistic Concurrency:** Implemented `[ConcurrencyCheck]` GUIDs to prevent "Double-Spend" attacks when multiple requests hit the same account simultaneously.
* **Idempotency:** Custom `X-Idempotency-Key` middleware protects against duplicate charges caused by flaky mobile networks or accidental retries.
* **JWT Security:** Cryptographic Claims-Based Authorization ensures users can only transfer funds from accounts they mathematically own.
* **Paginated Projections:** Optimized `GET` requests using `Skip()`, `Take()`, and EF Core data projection to safely handle millions of transaction receipts without memory overflow.
* **Financial Precision:** Strict `decimal(18,2)` schema design to eliminate floating-point rounding errors.

## 🛠️ Tech Stack
* **Framework:** .NET 8 (Minimal APIs)
* **ORM:** Entity Framework Core
* **Database:** SQLite
* **Security:** JSON Web Tokens (JWT) & ClaimsPrincipal

## 🏃‍♂️ How to Run Locally
1. Clone the repository.
2. Run `dotnet ef database update` to apply migrations and build the local SQLite database.
3. Run `dotnet run` to start the server.
4. Use Postman to hit `/api/auth/login?accountId=1` to generate your Bearer Token.