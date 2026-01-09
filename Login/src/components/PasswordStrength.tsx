import { Check, X } from "lucide-react";

const requirements = [
  { label: "Mínimo 8 caracteres", test: (v: string) => v.length >= 8 },
  { label: "Letra maiúscula", test: (v: string) => /[A-Z]/.test(v) },
  { label: "Letra minúscula", test: (v: string) => /[a-z]/.test(v) },
  { label: "Número", test: (v: string) => /[0-9]/.test(v) },
  { label: "Símbolo", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

type Props = {
  value: string;
};

export const PasswordStrength: React.FC<Props> = ({ value }) => {
  return (
    <div className="space-y-2 rounded-lg bg-slate-900/40 p-3">
      <p className="text-xs font-semibold text-slate-300">Requisitos da senha</p>
      <div className="grid grid-cols-1 gap-2 text-xs text-slate-200 sm:grid-cols-2">
        {requirements.map((req) => {
          const ok = req.test(value);
          return (
            <div key={req.label} className="flex items-center gap-2">
              {ok ? <Check className="h-4 w-4 text-emerald-400" /> : <X className="h-4 w-4 text-red-400" />}
              <span className={ok ? "text-emerald-200" : "text-slate-300"}>{req.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
