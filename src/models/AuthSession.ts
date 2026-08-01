import mongoose from "mongoose";

/**
 * One row per issued refresh token.
 *
 * The raw token never touches the database — only its sha256 — so a database
 * leak cannot be replayed as a login. Every rotation writes a NEW row that
 * inherits `familyId` from the root, which makes both "log this device out" and
 * "reuse detected, kill the whole chain" a single updateMany.
 */
const AuthSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    /** sha256 of the opaque refresh token. */
    tokenHash: { type: String, required: true },

    /** _id of the family root; inherited unchanged by every rotation. */
    familyId: { type: mongoose.Schema.Types.ObjectId, required: true },

    expiresAt: { type: Date, required: true },

    /** Stamped by the atomic rotation claim; the loser of a race reads it. */
    rotatedAt: { type: Date, default: null },
    replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AuthSession", default: null },

    revokedAt: { type: Date, default: null },
    /** LOGOUT | REUSE | INACTIVE | ADMIN */
    revokedReason: { type: String, default: null },

    lastUsedAt: { type: Date, default: Date.now },
    userAgent: { type: String },
    ip: { type: String },
  },
  { timestamps: true },
);

// TTL sweep. `expiresAt` is NEVER shortened on rotation — rotated rows have to
// stay queryable for their full lifetime or reuse detection goes blind.
AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AuthSessionSchema.index({ tokenHash: 1 }, { unique: true });
AuthSessionSchema.index({ familyId: 1 });
AuthSessionSchema.index({ userId: 1, revokedAt: 1 });

export const AuthSession =
  mongoose.models.AuthSession || mongoose.model("AuthSession", AuthSessionSchema);
