/**
 * Internal/test accounts held out of every analytics and report aggregate.
 *
 * These are real, logging-in accounts, so they can't just be soft-deleted with
 * `isActive: false` — but the moms/visits/shifts they record are test data that
 * would otherwise inflate every KPI, timeseries and data-quality counter. The
 * accounts keep working normally; they are only invisible to the reporting side.
 *
 * SERVER-ONLY (hits Mongo).
 *
 * The employee foreign key is named differently per collection — `createdBy` on
 * Mom/Visit, `userId` on Shift/LeaveRequest, `_id` on User itself — hence the
 * `field` argument on {@link excludeUsers}. Passing the wrong name would yield a
 * clause that silently matches nothing to exclude, so the union type is there to
 * turn that mistake into a compile error.
 */
import { Types } from "mongoose";
import { initDb } from "@/lib/mongoose";
import { User } from "@/models/User";

/** Accounts excluded from all analytics and reports. Add to this list to grow it. */
export const EXCLUDED_EMAILS = [
  "amr.hassan.emam@gmail.com",
  "a.ghandour@outboxsa.com",
  "a.elhawary@outboxsa.com",
] as const;

/** Which `$match` field holds the User ref, per collection. */
export type UserRefField = "createdBy" | "userId" | "_id";

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedIds: Types.ObjectId[] | null = null;
let cachedAt = 0;

/**
 * `_id`s of the excluded accounts.
 *
 * Memoised for {@link CACHE_TTL_MS}: the email list is static, and the admin
 * home fires ~10 analytics requests in parallel, so this saves a round trip on
 * each. The TTL bounds staleness if an account is ever renamed into or out of
 * the list. Emails not present in the database are simply absent from the result.
 */
export async function getExcludedUserIds(): Promise<Types.ObjectId[]> {
  const now = Date.now();
  if (cachedIds && now - cachedAt < CACHE_TTL_MS) return cachedIds;

  await initDb();
  // Case-insensitive so a differently-cased stored address still matches.
  const docs = (await User.find({
    email: { $in: EXCLUDED_EMAILS.map((e) => new RegExp(`^${escapeRegExp(e)}$`, "i")) },
  })
    .select("_id")
    .lean()) as unknown as { _id: Types.ObjectId }[];

  cachedIds = docs.map((d) => d._id);
  cachedAt = now;
  return cachedIds;
}

/**
 * `$match` fragment excluding those accounts on `field`, or `{}` when none of
 * the emails resolve to a real account — so spreading it is always safe:
 *
 *   { isActive: true, createdAt: range, ...excludeUsers("createdBy", ids) }
 */
export function excludeUsers(field: UserRefField, ids: Types.ObjectId[]): Record<string, unknown> {
  if (ids.length === 0) return {};
  return { [field]: { $nin: ids } };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
