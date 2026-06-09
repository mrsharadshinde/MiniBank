import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function StaffRoute() {
  const { isAuthenticated, role } = useAuth();

  // If they aren't logged in at all, kick them to login
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // If they are logged in, but they are just a regular Customer, kick them to the normal dashboard
  if (role !== "Admin" && role !== "Teller") {
    return <Navigate to="/dashboard" replace />;
  }

  // If they passed both checks, let them into the Staff area!
  return <Outlet />;
}