import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginInput, loginSchema } from "../schemas/auth.schema";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { Lock, Mail } from "lucide-react";

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    setError(null);
    try {
      await login(data);
      const search = new URLSearchParams(location.search);
      const next = search.get("next") || "/";
      // Em ambiente público (Cloudflare Tunnel), nunca fixe localhost:3000.
      // Redirecione para a mesma origem do site atual.
      const base = typeof window !== "undefined" ? window.location.origin : (import.meta.env.VITE_FRONT_URL || "http://localhost:3000");
      const target = next.startsWith("http") ? next : `${base}${next.startsWith("/") ? next : "/" + next}`;
      window.location.href = target;
    } catch (e: any) {
      setError(e.message || "Falha ao autenticar.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/70 p-8 shadow-card ring-1 ring-white/10 backdrop-blur">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-primary-200">Acesso seguro</p>
          <h1 className="text-2xl font-bold text-white">Entrar</h1>
          <p className="text-sm text-slate-400">Use seu email corporativo para continuar.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="email@nansen.com.br"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            showToggle
            error={errors.password?.message}
            {...register("password")}
          />

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}

          <Button type="submit" loading={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-end text-sm text-slate-300">
          <Link className="text-primary-300 hover:text-primary-200" to="/forgot-password">
            Esqueci minha senha
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-primary-200" />
            Login via email seguro
          </div>
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-primary-200" />
            Senha não armazenada no browser
          </div>
        </div>
      </div>
    </div>
  );
}
