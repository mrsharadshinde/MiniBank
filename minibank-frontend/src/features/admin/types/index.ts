// --- INTERFACES (Keep these exactly as they were) ---
export interface PendingTransfer {
  id: number;
  makerName: string;
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  remark: string;
  createdAt: string;
}
export interface PendingAccount {
  accountNumber: string;
  accountType: string;
  createdAt: string;
  ownerName: string;
  email: string;
}
export interface AuditLog {
  id: number;
  performedByUserId: number;
  performedByRole: string;
  targetUserId: number;
  action: string;
  oldValue: string;
  newValue: string;
  timestamp: string;
}
export type BankAccountInfo = {
  accountNumber: string;
  accountType: string;
  status: string;
  balance: number;
};

export type CustomerLookupResponse = {
  userId: number;
  ownerName: string;
  email: string;
  mobileNumber: string;
  matchedAccountNumber: string | null;
  accounts: BankAccountInfo[];
};

export interface RejectedResponse {
  id: number;
  makerUserId: number;
  makerName: string;
  checkerUserId: number | null;
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  status: string;
  remark: string;
  createdAt: string;
  reviewedAt: string | null;
}
