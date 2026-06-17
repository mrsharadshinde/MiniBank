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

## 🏦 MiniBank API - Frontend Implementation Guide
#1. Authentication & Tokens

All endpoints (except login and account creation) require a JWT.

Pass the token in the header: Authorization: Bearer <your_jwt_here>.

Customers log in via the OTP flow (/request-otp -> /verify-otp).

Staff (Admins/Tellers) log in using a standard email and password.

#2. The Idempotency Key (CRITICAL)

When building the Transfer Money component, you MUST generate a unique UUIDv4 on the frontend and send it in the headers as X-Idempotency-Key: <uuid>.

Do not regenerate this key if a network timeout occurs; only generate a new key for a brand-new transfer intent. This prevents double-charging.

#3. Handling the Maker-Checker Flow

When a Teller sends a standard transfer, it will return 200 OK.

However, if the amount is extremely high, the API will return a 202 Accepted instead, with a message saying it requires Admin approval.

Frontend Action: If you see a 202, show the user a UI alert saying: "Transfer submitted for Admin Review." Do not show it as a completed transaction.

#4. The Bulk Payroll Upload (Hangfire)

The /api/transfers/bulk-upload endpoint accepts multipart/form-data (.xlsx files).

It will instantly return a BatchId.

Frontend Action: Use this BatchId to poll the /status endpoint every 3 seconds. Show a loading bar to the user until the status returns Completed or Failed. If it fails, trigger a download using the /download-errors endpoint.