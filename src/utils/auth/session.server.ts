/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { AuthSession } from "@/models/AuthSession";
import { User } from "@/models/User";
import {
  REFRESH_TTL_SECONDS,
  ROTATION_LEEWAY_MS,
  hashToken,
  newRefreshToken,
  signAccessToken,
  type AuthPayload,
} from "./tokens";

/**
 * Database side of the refresh-token system: minting families, rotating them,
 * and revoking them. Node runtime only (Mongoose).
 */

function requestMeta(req: NextRequest) {
  return {
    userAgent: req.headers.get("user-agent")?.slice(0, 300),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
  };
}

const nextExpiry = () => new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);

/** Revoke every live row in a family — one device / one chain, in one write. */
export async function revokeFamily(familyId: any, reason: string): Promise<void> {
  await AuthSession.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

/** Revoke every session a user holds, on every device. */
export async function revokeAllForUser(userId: any, reason: string): Promise<void> {
  await AuthSession.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

/**
 * Start a new family. Used by login and by the one-time legacy-token upgrade.
 * The family root is its own `familyId`, so every later rotation just copies it.
 */
export async function createSessionFamily(userId: any, req: NextRequest) {
  const { raw, hash } = newRefreshToken();
  const _id = new mongoose.Types.ObjectId();
  const doc = await AuthSession.create({
    _id,
    familyId: _id,
    userId,
    tokenHash: hash,
    expiresAt: nextExpiry(),
    ...requestMeta(req),
  });
  return { raw, doc };
}

export type RotateResult =
  | { ok: true; userToken: string; refreshRaw: string; payload: AuthPayload }
  | { ok: false; reason: "UNKNOWN" | "REVOKED" | "EXPIRED" | "REUSE" | "INACTIVE" };

/**
 * Exchange a refresh token for a fresh pair.
 *
 * Concurrency is the whole difficulty here: the session keeper, a second tab
 * and a navigation can all present the same token at once. A naive
 * "read, check, write" would let several of them rotate, and strict reuse
 * detection would then read the siblings as token theft and log the employee
 * out. So the rotation is CLAIMED atomically and losers are forgiven for
 * ROTATION_LEEWAY_MS.
 */
export async function rotate(raw: string, req: NextRequest): Promise<RotateResult> {
  const now = new Date();
  const tokenHash = hashToken(raw);

  // Only one concurrent caller can match `rotatedAt: null`, so only one rotates.
  const claimed: any = await AuthSession.findOneAndUpdate(
    { tokenHash, revokedAt: null, rotatedAt: null, expiresAt: { $gt: now } },
    { $set: { rotatedAt: now, lastUsedAt: now } },
  );

  let familyId: any;
  let userId: any;
  let previousId: any = null;

  if (claimed) {
    familyId = claimed.familyId;
    userId = claimed.userId;
    previousId = claimed._id;
  } else {
    const row: any = await AuthSession.findOne({ tokenHash });
    if (!row) return { ok: false, reason: "UNKNOWN" };
    if (row.revokedAt) return { ok: false, reason: "REVOKED" };
    if (row.expiresAt <= now) return { ok: false, reason: "EXPIRED" };

    if (row.rotatedAt && now.getTime() - new Date(row.rotatedAt).getTime() > ROTATION_LEEWAY_MS) {
      // Rotated long ago and presented again — this is replay, not a race.
      await revokeFamily(row.familyId, "REUSE");
      return { ok: false, reason: "REUSE" };
    }

    // Inside the leeway: a sibling rotated milliseconds ago. Mint a second leaf
    // on the same family rather than logging a legitimate user out.
    familyId = row.familyId;
    userId = row.userId;
  }

  // Re-read identity on every rotation: without this a deactivated employee (or
  // one demoted from ADMIN) keeps their old role until the token expires.
  const user: any = await User.findById(userId).select("email role isActive").lean();
  if (!user || user.isActive === false) {
    await revokeFamily(familyId, "INACTIVE");
    return { ok: false, reason: "INACTIVE" };
  }

  const { raw: nextRaw, hash: nextHash } = newRefreshToken();
  const next = await AuthSession.create({
    familyId,
    userId,
    tokenHash: nextHash,
    expiresAt: nextExpiry(),
    ...requestMeta(req),
  });

  if (previousId) {
    await AuthSession.updateOne({ _id: previousId }, { $set: { replacedBy: next._id } });
  }

  const payload: AuthPayload = {
    _id: String(userId),
    email: user.email,
    role: user.role,
    sid: String(next._id),
  };

  return { ok: true, userToken: signAccessToken(payload), refreshRaw: nextRaw, payload };
}
