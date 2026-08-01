/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { initDb } from "@/lib/mongoose";
import { AuthSession } from "@/models/AuthSession";
import { User } from "@/models/User";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  hashToken,
  signAccessToken,
  verifyAccessToken,
  type AuthPayload,
} from "./tokens";

export type ServerSession = { userToken: string; payload: AuthPayload };

/**
 * The session a Server Component should read, and the token it should prop-drill.
 *
 * Why this exists rather than `cookies().get('access_token')`: ~14 server pages
 * self-fetch their own API over the network (`${process.env.URL}/api/...`).
 * A Node-side fetch carries NO cookie jar — only the Bearer header we pass — so
 * if the cookie's JWT has expired the page renders broken and no client-side
 * keeper can rescue it, because the render already happened.
 *
 * So when the cached access token is dead, mint a fresh one IN MEMORY straight
 * off the refresh row. This deliberately does not rotate: Server Components
 * cannot write cookies (Next throws), and rotating without being able to
 * persist the new token would invalidate the session. <SessionKeeper /> writes
 * a properly rotated pair immediately after hydration.
 */
export async function getServerSession(): Promise<ServerSession | null> {
  const jar = await cookies();

  const access = jar.get(ACCESS_COOKIE)?.value;
  const payload = verifyAccessToken(access);
  if (payload && access) return { userToken: access, payload }; // hot path, no DB

  const raw = jar.get(REFRESH_COOKIE)?.value;
  if (!raw) return null;

  await initDb();
  const row: any = await AuthSession.findOne({
    tokenHash: hashToken(raw),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!row) return null;

  const user: any = await User.findById(row.userId).select("email role isActive").lean();
  if (!user || user.isActive === false) return null;

  const fresh: AuthPayload = {
    _id: String(row.userId),
    email: user.email,
    role: user.role,
    sid: String(row._id),
  };
  return { userToken: signAccessToken(fresh), payload: fresh };
}

/**
 * Same, but bounces to /login when there is no live session.
 *
 * NOTE: `redirect()` works by throwing NEXT_REDIRECT — never call this inside a
 * try/catch that swallows errors.
 */
export async function requireServerSession(): Promise<ServerSession> {
  const session = await getServerSession();
  if (!session) redirect("/login?reason=expired");
  return session;
}
