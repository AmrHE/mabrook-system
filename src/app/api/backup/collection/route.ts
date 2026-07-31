/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { initDb } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/auth/requireAdmin";
import { getDb, listBackupCollections } from "@/utils/backup/collections";

export const dynamic = "force-dynamic";

const { EJSON } = mongoose.mongo.BSON;
const { ObjectId } = mongoose.Types;

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/**
 * GET /api/backup/collection?name=<collection>&after=<objectIdHex>&limit=<n>
 *
 * One page of raw documents from a single collection, serialised as **canonical
 * MongoDB Extended JSON** so ObjectIds (`$oid`), dates (`$date`) and numeric types
 * survive a Compass / mongoimport round-trip. A plain `JSON.stringify` would
 * flatten every `_id` to a string and break all cross-collection references
 * (Mom.hospital, Visit.mom, Shift.user, …), making the backup unrestorable.
 *
 * Pagination is keyset on `_id` rather than skip/limit: it is index-backed and
 * cannot duplicate or drop documents if the data changes mid-export. Pass the
 * previous page's `X-Last-Id` back as `?after=`; stop when `X-Doc-Count` is below
 * the requested limit.
 *
 * NOTE: the response body is a *fragment*, not standalone JSON — documents are
 * joined with ",\n" so the client can concatenate pages and wrap the result in
 * "[" … "]" to form one importable file, with no re-parsing and no memory-doubling
 * split. Page metadata rides on the `X-Doc-Count` / `X-Last-Id` headers, which the
 * browser can read because the fetch is same-origin.
 */
export async function GET(req: NextRequest) {
  await initDb();
  const auth = requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const params = req.nextUrl.searchParams;
    const name = params.get("name") ?? "";

    // Allowlist against the live collection list — never hand an unchecked query
    // param to db.collection(), which would expose system.* and anything else.
    const allowed = await listBackupCollections();
    if (!allowed.includes(name)) {
      return NextResponse.json({ status: 400, message: `Unknown collection: ${name}` }, { status: 400 });
    }

    const parsedLimit = Number.parseInt(params.get("limit") ?? "", 10);
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_LIMIT, 1), MAX_LIMIT);

    const after = params.get("after");
    let filter: Record<string, unknown> = {};
    if (after) {
      if (!OBJECT_ID_RE.test(after)) {
        return NextResponse.json({ status: 400, message: "Invalid `after` cursor" }, { status: 400 });
      }
      filter = { _id: { $gt: new ObjectId(after) } };
    }

    const docs = await getDb().collection(name).find(filter).sort({ _id: 1 }).limit(limit).toArray();

    const body = docs.map((doc) => EJSON.stringify(doc, { relaxed: false })).join(",\n");
    const lastId = docs.length ? String(docs[docs.length - 1]._id) : "";

    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-doc-count": String(docs.length),
        "x-last-id": lastId,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 500, message: err?.message || "Failed to read collection page" },
      { status: 500 },
    );
  }
}
