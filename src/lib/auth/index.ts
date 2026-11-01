// Deliberately does NOT re-export `./server`: that module pulls in better-auth
// and the Prisma adapter, which must never reach a client bundle. Import
// `@/lib/auth/server` explicitly from server code that needs the instance.
export * from "./auth-middleware";
export * from "./car-permissions";
export * from "./session";
