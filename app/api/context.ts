import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { authenticateRequest } from "./kimi/auth";
import { getOrCreateDefaultUser } from "./queries/users";

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
    // No session — fall through to the shared workspace user.
  }
  if (!ctx.user) {
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
