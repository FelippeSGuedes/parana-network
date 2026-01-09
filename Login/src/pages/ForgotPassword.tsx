import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ForgotPasswordInput, forgotPasswordSchema } from "../schemas/auth.schema";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { useState } from "react";
import { MailWarning } from "lucide-react";

export default function ForgotPassword() {
  const { forgotPassword, loading } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setMessage(null);
    setError(null);
    try {
      await forgotPassword(data);
      setMessage("Se o email existir, enviaremos instruções para redefinir sua senha.");
    } catch (e: any) {
      setError(e.message || "Não foi possível enviar as instruções.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/70 p-8 shadow-card ring-1 ring-white/10 backdrop-blur">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-primary-200">Recuperar acesso</p>
          <h1 className="text-2xl font-bold text-white">Esqueci minha senha</h1>
          <p className="text-sm text-slate-400">Não revelamos se o email existe. Mensagem sempre genérica.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Email"
            type="email"
            placeholder="voce@empresa.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />

          {message && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</p>}
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}

          <Button type="submit" loading={loading}>
            {loading ? "Enviando..." : "Enviar instruções"}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm text-slate-300">
          <Link className="text-primary-300 hover:text-primary-200" to="/login">
            Voltar para login
          </Link>
          <div className="flex items-center gap-2 text-slate-400">
            <MailWarning size={16} className="text-primary-200" />
            Mensagem sempre genérica
          </div>
        </div>
      </div>
    </div>
  );
}
