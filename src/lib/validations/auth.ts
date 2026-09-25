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
