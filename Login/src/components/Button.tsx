import { cn } from "../utils/cn";
import { Loader2 } from "lucide-react";
import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
};

export const Button: React.FC<ButtonProps> = ({ loading, className, children, disabled, ...rest }) => {
  return (
    <button
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-3 text-sm font-semibold text-white",
        "shadow-md transition hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/50",
        "disabled:cursor-not-allowed disabled:opacity-70",
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
};
