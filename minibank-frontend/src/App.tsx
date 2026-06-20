// src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { lazy, Suspense } from "react"; // 🔥 1. Import lazy and Suspense
import { Loader2 } from "lucide-react";

// 🔥 2. Import your new Error Boundary
import ErrorBoundary from "./components/ErrorBoundary"; 

// 3. Keep public/security routes as standard imports for instant loading
import Login from "./pages/Login";
import StaffLogin from "./pages/StaffLogin";
import ProtectedRoute from "./components/ProtectedRoute";
import StaffRoute from "./components/StaffRoute";

// 🔥 4. CODE SPLITTING: Lazy load all the heavy internal pages!
const Dashboard = lazy(() => import("./pages/Dashboard"));
const StaffDashboard = lazy(() => import("./pages/StaffDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const TransferFunds = lazy(() => import("./pages/TransferFunds"));
const BulkPayroll = lazy(() => import("./pages/BulkPayroll"));
const BulkPayrollHistory = lazy(() => import("./pages/BulkPayrollHistory"));

// A clean loading screen to show while the browser downloads the lazy chunks
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      <p className="text-slate-500 font-medium tracking-wide">Loading Module...</p>
    </div>
  </div>
);

function App() {
  return (
    // 🔥 Wrap the ENTIRE app to catch UI crashes anywhere
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          {/* 🔥 Wrap Routes in Suspense to handle the lazy loading transitions */}
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Login />} />
              <Route path="/staff-login" element={<StaffLogin />} />

              {/* Customer Routes (Wrapped in standard Bouncer) */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/transfer" element={<TransferFunds />} />
                <Route path="/bulk-payroll" element={<BulkPayroll />} />
                <Route path="/bulk-payroll-history" element={<BulkPayrollHistory />} />
              </Route>

              {/* Staff Routes (Wrapped in the STRICT Bouncer) */}
              <Route element={<StaffRoute />}>
                <Route path="/staff-dashboard" element={<StaffDashboard />} />
                <Route path="/admin-dashboard" element={<AdminDashboard />} />
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;