import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode"; // <-- 1. Import the new library

// 2. Expand the Control Room shape to include the Role
interface AuthContextType {
  isAuthenticated: boolean;
  role: string | null; // <-- NEW: Tracks if they are 'Customer', 'Teller', etc.
  login: (token: string, refreshToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  
  // 3. Helper function to safely read the role from a token
  const extractRoleFromToken = (token: string): string | null => {
    try {
      const decoded: any = jwtDecode(token);
      // C# often puts roles in a long Microsoft schema URL, or a simple 'role' property.
      // We check for both just to be safe!
      return decoded.role || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || 'Customer';
    } catch (error) {
      return null;
    }
  };

  // 4. Initialize state checking the browser backpack
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem("accessToken"));
  
  const [role, setRole] = useState<string | null>(() => {
    const token = localStorage.getItem("accessToken");
    return token ? extractRoleFromToken(token) : null;
  });

  const login = (token: string, refreshToken: string) => {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("refreshToken", refreshToken);
    
    // Crack the new token open and find out who just logged in
    const userRole = extractRoleFromToken(token);
    
    setIsAuthenticated(true);
    setRole(userRole);

    // 5. THE TRAFFIC COP: Route them based on their badge!
    if (userRole === "Admin") {
      navigate("/admin-dashboard");
    } else if( userRole === "Teller") {
      navigate("/staff-dashboard");
    } else{
      navigate("/dashboard");
    }
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setIsAuthenticated(false);
    setRole(null);
    navigate("/"); 
  };

  // Expose the 'role' to the rest of the app
  return (
    <AuthContext.Provider value={{ isAuthenticated, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};