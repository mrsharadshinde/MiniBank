import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();

  // If the user is NOT logged in, silently teleport them to the Login page.
  // The 'replace' flag ensures they can't use the browser's "Back" button to bypass this.
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // If they ARE logged in, render whatever page is inside this wrapper (<Outlet />)
  return <Outlet />;
}