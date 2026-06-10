# 🏦 MiniBank: Enterprise Core Banking Platform

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![.NET Core](https://img.shields.io/badge/.NET_8.0-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-005C84?style=for-the-badge&logo=mysql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

MiniBank is a full-stack, role-based core banking platform designed to simulate enterprise financial workflows. Built with a **C# .NET Minimal API** backend and a **React TypeScript** frontend, this platform enforces strict financial compliance, secure over-the-counter (OTC) processing, and idempotency guarantees.

Developed by **Sharad Shinde**.

---

## ✨ Enterprise Architecture & Key Features

This project was built to go beyond standard CRUD operations, focusing on the security and architectural patterns required in real-world financial technology.

### 🛡️ 1. Maker-Checker Approval Workflow
High-value transfers requested by users are intercepted and placed into a `Pending` state. The system enforces **Segregation of Duties**, requiring a CTO/Admin to physically review and execute the transaction via a secure Control Center. 

### 🔒 2. Idempotent Transactions (`X-Idempotency-Key`)
To prevent accidental double-charging due to network latency or user double-clicks, the React frontend generates a unique `uuid` for every transfer attempt. The C# backend verifies this key, ensuring that identical transaction requests are processed exactly once.

### 📖 3. Immutable Double-Entry Ledger
Financial data is never overwritten. Every transaction (deposits, withdrawals, transfers) generates balanced, immutable `LedgerEntry` records (Credits and Debits) linked to a parent `TransactionRecord`, ensuring 100% auditability.

### 👥 4. Role-Based Access Control (RBAC) & Custom Dashboards
The application serves three distinct JWT-authenticated experiences:
* **Customer Portal:** View accounts, generate paginated transaction histories, initiate internal transfers, and execute Bulk Payroll uploads via multipart/form-data.
* **Teller CRM:** Securely search customers via 12-digit Account IDs, process OTC cash deposits/withdrawals linked to a Central Vault, and update KYC contact details.
* **Admin Control Center:** Provision new staff, approve/reject pending transfers, activate newly onboarded accounts, and review the read-only Compliance Audit Log.

---

## 🛠️ Technology Stack

**Frontend (Client)**
* **Framework:** React 18 with Vite
* **Language:** TypeScript
* **Styling:** Tailwind CSS + Lucide Icons
* **State Management & Fetching:** React Hooks, Axios (with interceptors)

**Backend (API)**
* **Framework:** .NET 8 (Minimal APIs)
* **Language:** C#
* **ORM & Database:** Entity Framework Core (EF Core)
* **Security:** JWT Bearer Authentication, BCrypt Password Hashing
* **Validation:** FluentValidation

---

## 📸 Platform Previews

> *(Developer Note: Take screenshots of your running app and save them in a folder called `docs/images/`. Update the links below to make your README visually pop!)*

<details>
<summary><b>1. Customer Dashboard & Idempotent Transfers</b></summary>
<img src="./docs/images/customer-dashboard.png" alt="Customer Dashboard" width="800"/>
</details>

<details>
<summary><b>2. Teller CRM & OTC Operations</b></summary>
<img src="./docs/images/teller-crm.png" alt="Teller CRM" width="800"/>
</details>

<details>
<summary><b>3. Admin Control Center & Audit Log</b></summary>
<img src="./docs/images/admin-dashboard.png" alt="Admin Dashboard" width="800"/>
</details>

---

## 🚀 Getting Started (Local Development)

### Prerequisites
* Node.js (v18+)
* .NET 8 SDK
* SQL Database (Local or Cloud)

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend