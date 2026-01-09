import { forwardRef } from "react";
import { cn } from "../utils/cn";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { useState } from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  showToggle?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, showToggle = false, type = "text", className, ...rest }, ref) => {
    const [visible, setVisible] = useState(false);
    const isPassword = type === "password";
    const inputType = showToggle && isPassword ? (visible ? "text" : "password") : type;

    return (
      <label className="block space-y-2 text-sm font-medium text-slate-200">
        <span>{label}</span>
        <div className={cn("relative", className)}>
          <input
            ref={ref}
            type={inputType}
            className={cn(
              "w-full rounded-lg border bg-slate-900/60 px-4 py-3 text-slate-100 placeholder-slate-500 shadow-sm transition",
              "border-slate-700 focus:border-primary-400 focus:ring-2 focus:ring-primary-400/40 disabled:opacity-60",
              error ? "border-red-500 focus:border-red-400 focus:ring-red-400/30" : ""
            )}
            {...rest}
          />
          {showToggle && isPassword && (
            <button
              type="button"
              aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
              className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-100"
              onClick={() => setVisible((v) => !v)}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-300">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
        {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      </label>
    );
  }
);
Input.displayName = "Input";
