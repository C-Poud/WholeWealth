import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { authenticateRequest } from "./auth/auth";
import { getOrCreateDefaultUser } from "./queries/users";
import { env } from "./lib/env";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  try {
    ctx.user = await authenticateRequest(opts.req.headers);
  } catch {
    // No session — see below.
  }
  if (!ctx.user && !env.googleEnabled) {
    // No-auth mode (Google sign-in not configured): map every request to the
    // shared workspace user. When Google sign-in IS configured, requests
    // without a valid session stay unauthenticated and hit the login gate.
    try {
      ctx.user = await getOrCreateDefaultUser();
    } catch (err) {
      // Database may still be initializing on cold start; the request will
      // surface as unauthenticated and the client retries automatically.
      console.warn("[context] default workspace user unavailable:", err);
    }
  }
  return ctx;
}
