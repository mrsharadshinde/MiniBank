// AuthContext.tsx
import { createContext, useContext, useState} from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../api/axiosClient";

interface AuthContextType {
  isAuthenticated: boolean;
  role: string | null;
  login: (userRole: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  
  // Track state using values safe for JavaScript visibility
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem("user_logged_in"));
  const [role, setRole] = useState<string | null>(() => localStorage.getItem("user_role"));

  const login = (userRole: string) => {
    // We mark the session in localStorage simply to persist UI state across refreshes,
    // NOT for real cryptographic authentication. The secure cookie handles that!
    localStorage.setItem("user_logged_in", "true");
    localStorage.setItem("user_role", userRole);
    
    setIsAuthenticated(true);
    setRole(userRole);

    // Route traffic smoothly based on the backend role assertion
    if (userRole === "Admin") {
      navigate("/admin-dashboard");
    } else if (userRole === "Teller") {
      navigate("/staff-dashboard");
    } else {
      navigate("/dashboard");
    }
  };

  const logout = async () => {
    try {
      // Hit the backend endpoint to clear the server-side HttpOnly cookies
      await axiosClient.post("/api/auth/logout");
    } catch (err) {
      console.error("Server logout cleanup failed", err);
    } finally {
      localStorage.removeItem("user_logged_in");
      localStorage.removeItem("user_role");
      setIsAuthenticated(false);
      setRole(null);
      navigate("/");
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};