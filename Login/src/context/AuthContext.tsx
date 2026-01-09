import { createContext, useContext, useMemo, useState } from "react";
import { login as loginApi, register as registerApi, forgotPassword as forgotApi } from "../api/auth";
import { LoginInput, RegisterInput, ForgotPasswordInput } from "../schemas/auth.schema";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (payload: LoginInput) => Promise<void>;
  register: (payload: RegisterInput) => Promise<void>;
  forgotPassword: (payload: ForgotPasswordInput) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const login = async (payload: LoginInput) => {
    setLoading(true);
    try {
      const res = await loginApi(payload);
      setUser(res.user);
      setToken(res.access_token);
    } finally {
      setLoading(false);
    }
  };

  // Register disabled (returns rejected promise)
  const register = async (_payload: RegisterInput) => {
    return Promise.reject(new Error("Cadastro desativado"));
  };

  const forgotPassword = async (payload: ForgotPasswordInput) => {
    setLoading(true);
    try {
      await forgotApi(payload);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({ user, token, loading, login, register, forgotPassword, logout }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
