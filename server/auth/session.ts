import * as jose from "jose";
import { env } from "../lib/env";

export interface SessionPayload {
  unionId: string;
  clientId?: string;
}

const JWT_ALG = "HS256";

export async function signSessionToken(
  payload: SessionPayload,
): Promise<string> {
  const secret = new TextEncoder().encode(env.appSecret || "networth-secret-key-fallback");
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("1 year")
    .sign(secret);
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  if (!token) {
    return null;
  }
  try {
    const secret = new TextEncoder().encode(env.appSecret || "networth-secret-key-fallback");
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: [JWT_ALG],
    });
    const { unionId, clientId } = payload;
    if (!unionId) {
      return null;
    }
    return { unionId: String(unionId), clientId: clientId ? String(clientId) : undefined };
  } catch (error) {
    console.warn("[session] JWT verification failed:", error);
    return null;
  }
}
