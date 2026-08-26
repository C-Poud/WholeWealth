import { createRouter, adminQuery } from "./middleware";
import { listUsers } from "./queries/users";

export const adminRouter = createRouter({
  /** Admin-only: everyone who has signed in (Google name + email). */
  users: adminQuery.query(() => listUsers()),
});
