import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { appSettings } from "@db/schema";

const BASE_URL = "https://api.snaptrade.com/api/v1";
const API_PATH_PREFIX = "/api/v1";

export interface SnaptradeConfig {
  clientId: string;
  consumerKey: string;
}

/**
 * Resolves SnapTrade credentials. Priority: app_settings table (managed via
 * the in-app Settings page) → environment variables. Returns null when the
 * integration is not configured (the app then runs in demo mode).
 */
export async function getSnaptradeConfig(): Promise<SnaptradeConfig | null> {
  let clientId = process.env.SNAPTRADE_CLIENT_ID ?? "";
  let consumerKey = process.env.SNAPTRADE_CONSUMER_KEY ?? "";

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "snaptrade"));
    const stored = rows[0]?.value
      ? (JSON.parse(rows[0].value) as Partial<SnaptradeConfig>)
      : {};
    clientId = stored.clientId?.trim() || clientId;
    consumerKey = stored.consumerKey?.trim() || consumerKey;
  } catch {
    // Settings table may not exist yet on first boot — fall back to env.
  }

  if (!clientId || !consumerKey) return null;
  return { clientId, consumerKey };
}

/**
 * SnapTrade request signature (see SnapTrade docs → Authentication):
 * HMAC-SHA256 over JSON.stringify({ content, path, query }) where
 *   - content = the request body exactly as transmitted (or null)
 *   - path    = endpoint path INCLUDING the /api/v1 prefix
 *   - query   = the full query string, params sorted alphabetically
 * Key order content/path/query and body key insertion order must be
 * preserved — JSON.stringify (not sorted) is intentional.
 */
function sign(
  consumerKey: string,
  path: string,
  query: string,
  body: unknown,
): string {
  const sigObject = {
    content: body === undefined || body === null ? null : body,
    path: `${API_PATH_PREFIX}${path}`,
    query,
  };
  const sigContent = JSON.stringify(sigObject);
  return crypto
    .createHmac("sha256", consumerKey)
    .update(sigContent)
    .digest("base64");
}

export class SnaptradeError extends Error {
  readonly status?: number;
  readonly body?: unknown;
  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  path: string; // e.g. "/snapTrade/registerUser"
  query?: Record<string, string>;
  body?: unknown;
}

/** Signed request against the SnapTrade API. */
async function snaptradeRequest<T>(
  config: SnaptradeConfig,
  opts: RequestOptions,
): Promise<T> {
  const params = new URLSearchParams({
    clientId: config.clientId,
    timestamp: Math.floor(Date.now() / 1000).toString(),
    ...opts.query,
  });
  params.sort(); // SnapTrade requires alphabetically sorted query params
  const queryString = params.toString();
  const signature = sign(config.consumerKey, opts.path, queryString, opts.body);

  const res = await fetch(`${BASE_URL}${opts.path}?${queryString}`, {
    method: opts.method ?? "GET",
    headers: {
      Signature: signature,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const detail =
      typeof data === "object" && data !== null
        ? JSON.stringify(data)
        : String(data ?? res.statusText);
    throw new SnaptradeError(
      `SnapTrade ${opts.method ?? "GET"} ${opts.path} failed (${res.status}): ${detail}`,
      res.status,
      data,
    );
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Endpoint wrappers
// ---------------------------------------------------------------------------

export async function checkApiStatus(config: SnaptradeConfig) {
  return snaptradeRequest<{ version?: number; timestamp?: string; online?: boolean }>(
    config,
    { path: "/" },
  );
}

export async function registerSnaptradeUser(
  config: SnaptradeConfig,
  userId: string,
) {
  return snaptradeRequest<{ userId: string; userSecret: string }>(config, {
    method: "POST",
    path: "/snapTrade/registerUser",
    body: { userId },
  });
}

export async function deleteSnaptradeUser(
  config: SnaptradeConfig,
  userId: string,
) {
  return snaptradeRequest(config, {
    method: "DELETE",
    path: "/snapTrade/deleteUser",
    query: { userId },
  });
}

export async function getConnectionPortalLink(
  config: SnaptradeConfig,
  userId: string,
  userSecret: string,
  customRedirect: string,
) {
  return snaptradeRequest<{ redirectURI?: string; sessionId?: string }>(
    config,
    {
      method: "POST",
      path: "/snapTrade/login",
      query: { userId, userSecret },
      body: {
        connectionType: "read",
        customRedirect,
        connectionPortalVersion: "v4",
      },
    },
  );
}

export interface SnaptradeAccount {
  id: string;
  name?: string;
  number?: string;
  institution_name?: string;
  status?: string | null;
  balance?: { total?: { amount?: number | null; currency?: string | null } };
  meta?: Record<string, unknown>;
}

export async function listAccounts(
  config: SnaptradeConfig,
  userId: string,
  userSecret: string,
) {
  return snaptradeRequest<SnaptradeAccount[]>(config, {
    path: "/accounts",
    query: { userId, userSecret },
  });
}

export interface SnaptradePosition {
  units?: number | null;
  price?: number | null;
  average_purchase_price?: number | null;
  currency?: { code?: string } | null;
  symbol?: {
    symbol?: {
      id?: string;
      symbol?: string;
      description?: string;
      security_type?: { code?: string };
    };
    raw_symbol?: string;
    option_symbol?: {
      ticker?: string;
      strike_price?: number;
      expiration_date?: string;
      option_type?: string; // "CALL" | "PUT"
      underlying_symbol?: { symbol?: string };
    } | null;
  };
}

export async function listAccountPositions(
  config: SnaptradeConfig,
  accountId: string,
  userId: string,
  userSecret: string,
) {
  return snaptradeRequest<SnaptradePosition[]>(config, {
    path: `/accounts/${accountId}/positions`,
    query: { userId, userSecret },
  });
}

export interface SnaptradeQuote {
  symbol?: string;
  last_trade_price?: number | null;
  bid_price?: number | null;
  ask_price?: number | null;
}

export async function getQuotes(
  config: SnaptradeConfig,
  accountId: string,
  userId: string,
  userSecret: string,
  symbols: string[],
) {
  return snaptradeRequest<SnaptradeQuote[]>(config, {
    path: `/accounts/${accountId}/quotes`,
    query: { userId, userSecret, symbols: symbols.join(","), useTicker: "true" },
  });
}

export interface OptionChainContract {
  strike_price?: number;
  expiry_date?: string;
  option_type?: string; // CALL | PUT
  bid_price?: number | null;
  ask_price?: number | null;
  last_price?: number | null;
  open_interest?: number | null;
  volume?: number | null;
  implied_volatility?: number | null;
  delta?: number | null;
}

export async function getOptionsChain(
  config: SnaptradeConfig,
  accountId: string,
  userId: string,
  userSecret: string,
  symbol: string,
) {
  return snaptradeRequest<OptionChainContract[]>(config, {
    path: `/accounts/${accountId}/optionsChain`,
    query: { userId, userSecret, symbol },
  });
}
