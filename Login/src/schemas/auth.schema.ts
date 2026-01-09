import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Informe sua senha"),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Informe seu nome"),
    email: z.string().email("Email inválido"),
    password: z
      .string()
      .min(8, "Use ao menos 8 caracteres")
      .regex(/[A-Z]/, "Inclua uma letra maiúscula")
      .regex(/[a-z]/, "Inclua uma letra minúscula")
      .regex(/[0-9]/, "Inclua um número")
      .regex(/[^A-Za-z0-9]/, "Inclua um símbolo"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
