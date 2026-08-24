import { z } from "zod";
import { createRouter, adminQuery } from "./middleware";
import { listUsers } from "./queries/users";
import { resetUserPortfolioData } from "./queries/portfolio";

export const adminRouter = createRouter({
  /** Admin-only: list all signed-in users with their cash balances, broker accounts, and status. */
  users: adminQuery.query(() => listUsers()),

  /** Admin-only: clear/reset user's linked accounts and synced data so they can re-auth (not banned). */
  resetUserAccount: adminQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      await resetUserPortfolioData(input.userId);
      return {
        success: true,
        message: "User account reset successfully. The user can now re-authenticate.",
      };
    }),
});
