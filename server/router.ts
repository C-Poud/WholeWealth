import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { snaptradeRouter } from "./snaptrade-router";
import { portfolioRouter } from "./portfolio-router";
import { analyticsRouter } from "./analytics-router";
import { settingsRouter } from "./settings-router";
import { adminRouter } from "./admin-router";
import { suggestionsRouter } from "./suggestions-router";
import { watchlistRouter } from "./watchlist-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  snaptrade: snaptradeRouter,
  portfolio: portfolioRouter,
  analytics: analyticsRouter,
  settings: settingsRouter,
  admin: adminRouter,
  suggestions: suggestionsRouter,
  watchlist: watchlistRouter,
});

export type AppRouter = typeof appRouter;
