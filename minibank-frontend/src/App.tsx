import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/Login";
import StaffLogin from "./pages/StaffLogin";
import Dashboard from "./pages/Dashboard";
import StaffDashboard from "./pages/StaffDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import StaffRoute from "./components/StaffRoute";
import TransferFunds from "./pages/TransferFunds";
import BulkPayroll from "./pages/BulkPayroll";
import AdminDashboard from "./pages/AdminDashboard";
import BulkPayrollHistory from "./pages/BulkPayrollHistory"; // <-- UNCOMMENTED

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/staff-login" element={<StaffLogin />} />

          {/* Customer Routes (Wrapped in standard Bouncer) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transfer" element={<TransferFunds />} />
            <Route path="/bulk-payroll" element={<BulkPayroll />} />
            
            {/* <-- UNCOMMENTED AND FIXED ROUTE NAME --> */}
            <Route path="/bulk-payroll-history" element={<BulkPayrollHistory />} />
          </Route>

          {/* Staff Routes (Wrapped in the STRICT Bouncer) */}
          <Route element={<StaffRoute />}>
            <Route path="/staff-dashboard" element={<StaffDashboard />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;