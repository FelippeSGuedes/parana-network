import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RegisterInput, registerSchema } from "../schemas/auth.schema";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { PasswordStrength } from "../components/PasswordStrength";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ShieldCheck, UserRound } from "lucide-react";

export default function Register() {
  const { register: registerUser, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const passwordValue = watch("password") || "";

  const onSubmit = async (data: RegisterInput) => {
    setError(null);
    try {
      await registerUser(data);
      navigate("/login", { replace: true });
    } catch (e: any) {
      setError(e.message || "Não foi possível criar sua conta.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900/70 p-8 shadow-card ring-1 ring-white/10 backdrop-blur">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-primary-200">Crie sua conta</p>
          <h1 className="text-2xl font-bold text-white">Cadastro</h1>
          <p className="text-sm text-slate-400">Defina uma senha forte. Não guardamos sua senha no navegador.</p>
        </div>

        <form className="grid gap-6 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <Input
              label="Nome"
              placeholder="Seu nome"
              autoComplete="name"
              error={errors.name?.message}
              {...register("name")}
            />
            <Input
              label="Email"
              type="email"
              placeholder="voce@empresa.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Senha"
              type="password"
              placeholder="Senha forte"
              showToggle
              autoComplete="new-password"
              error={errors.password?.message}
              {...register("password")}
            />
            <Input
              label="Confirmar senha"
              type="password"
              placeholder="Repita a senha"
              showToggle
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />
            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
            <Button type="submit" loading={loading}>
              {loading ? "Criando..." : "Criar conta"}
            </Button>
            <Link className="text-sm text-primary-300 hover:text-primary-200" to="/login">
              Voltar para login
            </Link>
          </div>

          <div className="space-y-4">
            <PasswordStrength value={passwordValue} />
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
              <div className="mb-2 flex items-center gap-2 text-slate-200">
                <ShieldCheck size={18} className="text-primary-200" />
                Segurança do front
              </div>
              <ul className="list-disc space-y-1 pl-5 text-slate-300">
                <li>Token ficará em memória (Context), pronto para cookie HttpOnly no backend.</li>
                <li>Não logamos credenciais no console.</li>
                <li>Validamos entradas no cliente e no servidor (quando integrar).</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
              <div className="mb-2 flex items-center gap-2 text-slate-200">
                <UserRound size={18} className="text-primary-200" />
                Benefícios
              </div>
              <ul className="list-disc space-y-1 pl-5 text-slate-300">
                <li>Fluxo desacoplado, pronto para integrar via API.</li>
                <li>Responsivo e preparado para dark mode.</li>
                <li>Erros amigáveis, sem vazar detalhes.</li>
              </ul>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
