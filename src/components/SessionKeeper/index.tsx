"use client";

import { useEffect } from "react";

const PING_MS = 10 * 60 * 1000; // the endpoint no-ops unless the token is near expiry
const MIN_GAP_MS = 60 * 1000; // cross-tab damper
const LS_KEY = "mabrook:lastRefreshAt";

/** Module scope, so concurrent callers in THIS tab share one request. */
let inflight: Promise<boolean> | null = null;

async function refresh(force = false): Promise<boolean> {
  if (inflight) return inflight;

  if (!force) {
    try {
      const last = Number(window.localStorage.getItem(LS_KEY) ?? 0);
      // A sibling tab just refreshed; tabs share one cookie jar, so we already
      // have the new token.
      if (Date.now() - last < MIN_GAP_MS) return true;
    } catch {
      // localStorage can throw in private modes — fall through and just refresh.
    }
  }

  inflight = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST", cache: "no-store" });
      try {
        window.localStorage.setItem(LS_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      return res.ok;
    } catch {
      // Offline or a flaky network is NOT a logout.
      return true;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Keeps the httpOnly access-token cookie fresh for as long as the app is open.
 *
 * Two things depend on it: API routes fall back to the cookie when a
 * prop-drilled Bearer has gone stale in a long-open tab, and the next server
 * render reads a live token. It also performs the one-time upgrade of a legacy
 * (pre-refresh-token) session on the first page load after deploy.
 *
 * Mounted once in the (internal) layout — layouts survive soft navigation, so
 * this mounts per hard load rather than per page.
 */
export default function SessionKeeper() {
  useEffect(() => {
    let cancelled = false;

    const run = async (force = false) => {
      const ok = await refresh(force);
      if (!ok && !cancelled) {
        // Hard navigation, not router.push: it discards every stale
        // prop-drilled token still held in the React tree.
        window.location.href = "/login?reason=expired";
      }
    };

    run(true); // cold load / legacy upgrade

    const id = setInterval(() => run(), PING_MS);
    const onWake = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
  }, []);

  return null;
}
