import axios from "axios";
import { LoginInput, RegisterInput, ForgotPasswordInput } from "../schemas/auth.schema";

// IMPORTANTE (túnel Cloudflare): se usarmos VITE_API_URL="http://localhost:5000",
// isso funciona só localmente. Para qualquer acesso externo, "localhost" vira o PC do visitante.
// Então, no browser SEMPRE use a mesma origem do site e deixe VITE_API_URL apenas para contextos
// sem window (SSR/testes) ou quando realmente for necessário.
const apiBase =
  typeof window !== "undefined"
    ? window.location.origin
    : import.meta.env.VITE_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: apiBase,
  timeout: 10000,
  withCredentials: true, // needed to receive/set auth cookies
});

// Simple progressive delay to slow brute-force attempts on the client side
let attempt = 0;
const delay = async () => {
  attempt += 1;
  const ms = Math.min(2000, 200 * attempt);
  await new Promise((res) => setTimeout(res, ms));
};

export const resetAttempt = () => {
  attempt = 0;
};

export async function login(payload: LoginInput) {
  await delay();
  try {
    const { data } = await api.post("/auth/login", payload);
    resetAttempt();
    return data;
  } catch (err: any) {
    const msg = err?.response?.data?.error || err?.response?.data?.message;
    throw new Error(msg || "Não foi possível autenticar. Tente novamente.");
  }
}

export async function register(payload: RegisterInput) {
  try {
    const { data } = await api.post("/auth/register", payload);
    return data;
  } catch (err: any) {
    throw new Error(err?.response?.data?.message || "Não foi possível criar sua conta.");
  }
}

export async function forgotPassword(payload: ForgotPasswordInput) {
  try {
    const { data } = await api.post("/auth/forgot-password", payload);
    return data;
  } catch (err: any) {
    throw new Error("Se o email existir, enviaremos instruções.");
  }
}
