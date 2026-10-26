import { z } from "zod";

export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "El email es requerido")
      .email("Por favor ingresa un email válido")
      .toLowerCase(),

    password: z
      .string()
      .trim()
      .min(6, "La contraseña debe tener al menos 6 caracteres"),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "El email es requerido")
      .email("Por favor ingresa un email válido")
      .toLowerCase(),
  })
  .strict();

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * The 8-character minimum mirrors `emailAndPassword.minPasswordLength` in
 * `src/lib/auth/server.ts`. Better-auth rejects anything shorter server-side
 * anyway; validating here only saves a round trip and a vague error.
 */
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .trim()
      .min(8, "La contraseña debe tener al menos 8 caracteres"),

    confirmPassword: z.string().trim(),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
