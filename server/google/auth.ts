import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { env } from "../lib/env";
import { getSessionCookieOptions } from "../lib/cookies";
import { Session } from "@contracts/constants";
import { signSessionToken } from "../auth/session";
import { upsertUser } from "../queries/users";

/**
 * Google OAuth 2.0 (authorization code flow, OIDC).
 *
 * Routes:
 *   GET /api/oauth/google          → redirect to Google's consent screen
 *   GET /api/oauth/google/callback → exchange code, upsert user, set session
 *
 * Requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. In Google Cloud Console,
 * add an authorized redirect URI:  https://<your-domain>/api/oauth/google/callback
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

function callbackUri(c: Context): string {
  // Behind a reverse proxy (Railway), the public scheme/host arrive via
  // forwarded headers — req.url itself is plain http.
  const proto =
    c.req.header("x-forwarded-proto") ??
    new URL(c.req.url).protocol.replace(":", "");
  const host =
    c.req.header("x-forwarded-host") ??
    c.req.header("host") ??
    new URL(c.req.url).host;
  return `${proto}://${host}/api/oauth/google/callback`;
}

type GoogleProfile = {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
};

export function googleLoginHandler() {
  return (c: Context) => {
    if (!env.googleEnabled) {
      return c.json({ error: "Google sign-in is not configured" }, 501);
    }
    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", env.googleClientId);
    url.searchParams.set("redirect_uri", callbackUri(c));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");
    return c.redirect(url.toString(), 302);
  };
}

export function googleCallbackHandler() {
  return async (c: Context) => {
    if (!env.googleEnabled) {
      return c.json({ error: "Google sign-in is not configured" }, 501);
    }

    const error = c.req.query("error");
    if (error) {
      return c.redirect(`/login?error=${encodeURIComponent(error)}`, 302);
    }
    const code = c.req.query("code");
    if (!code) {
      return c.redirect("/login?error=missing_code", 302);
    }

    try {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: callbackUri(c),
      });
      const tokenResp = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!tokenResp.ok) {
        throw new Error(
          `Token exchange failed (${tokenResp.status}): ${await tokenResp.text()}`,
        );
      }
      const tokens = (await tokenResp.json()) as { access_token: string };

      const profileResp = await fetch(USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!profileResp.ok) {
        throw new Error("Failed to fetch Google user profile");
      }
      const profile = (await profileResp.json()) as GoogleProfile;
      if (!profile.sub) {
        throw new Error("Google profile missing subject id");
      }

      const unionId = `google_${profile.sub}`;
      await upsertUser({
        unionId,
        name: profile.name ?? null,
        email: profile.email ?? null,
        avatar: profile.picture ?? null,
        lastSignInAt: new Date(),
      });

      const token = await signSessionToken({ unionId, clientId: "google" });
      const cookieOpts = getSessionCookieOptions(c.req.raw.headers);
      setCookie(c, Session.cookieName, token, {
        ...cookieOpts,
        maxAge: Session.maxAgeMs / 1000,
      });

      return c.redirect("/", 302);
    } catch (err) {
      console.error("[google] OAuth callback failed", err);
      return c.redirect("/login?error=google_auth_failed", 302);
    }
  };
}
