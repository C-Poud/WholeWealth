import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { googleCallbackHandler, googleLoginHandler } from "./google/auth";
import { runMigrations } from "./migrate";
import { Paths } from "@contracts/constants";

// Ensure database schema exists (production runtime is the only environment
// with network access to the database). Runs in the background with retries
// so server startup / health checks are never blocked by a cold database.
if (env.isProduction || process.env.RUN_MIGRATIONS === "1") {
  void (async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await runMigrations();
        return;
      } catch {
        const wait = attempt * 5000;
        console.warn(`[migrate] attempt ${attempt} failed, retrying in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  })();
}

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());
app.get("/api/oauth/google", googleLoginHandler());
app.get("/api/oauth/google/callback", googleCallbackHandler());
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
