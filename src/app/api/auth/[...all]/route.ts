import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/server";

/**
 * Mounts every better-auth endpoint under `/api/auth/*`
 * (`sign-in/email`, `sign-out`, `get-session`, ...).
 */
export const { GET, POST } = toNextJsHandler(auth);
