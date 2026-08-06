import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface AdminUser { id: number; name: string; email: string; role: string; mustChangePassword?: boolean; }

interface AdminAuthContextType {
  admin: AdminUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string; requireOtp?: boolean; otpToken?: string; adminName?: string; mustChangePassword?: boolean; }>;
  verifyOtp: (otpToken: string, code: string) => Promise<{ success: boolean; message?: string; mustChangePassword?: boolean; }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("admin_token");
    const savedAdmin = localStorage.getItem("admin_user");
    if (saved && savedAdmin) {
      setToken(saved);
      setAdmin(JSON.parse(savedAdmin));
    }
  }, []);

  const setSession = (tok: string, usr: AdminUser) => {
    setToken(tok);
    setAdmin(usr);
    localStorage.setItem("admin_token", tok);
    localStorage.setItem("admin_user", JSON.stringify(usr));
  };

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message };

    if (data.requireOtp) {
      return { success: true, requireOtp: true, otpToken: data.otpToken, adminName: data.adminName };
    }

    setSession(data.token, data.admin);
    return { success: true, mustChangePassword: data.admin?.mustChangePassword };
  };

  const verifyOtp = async (otpToken: string, code: string) => {
    const res = await fetch("/api/admin/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpToken, code }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message };
    setSession(data.token, data.admin);
    return { success: true, mustChangePassword: data.admin?.mustChangePassword };
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    const tok = localStorage.getItem("admin_token");
    const res = await fetch("/api/admin/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setSession(data.token, data.admin);
    return true;
  };

  const logout = () => {
    setToken(null);
    setAdmin(null);
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
  };

  return (
    <AdminAuthContext.Provider value={{ admin, token, login, verifyOtp, changePassword, logout, isAuthenticated: !!token }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be inside AdminAuthProvider");
  return ctx;
}

export function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("admin_token");
  const isFormData = options.body instanceof FormData;
  return fetch(url, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}
