import { NextRequest, NextResponse } from "next/server";
// import bcrypt from "bcrypt";
import { initDb } from "../../../../lib/mongoose";
import { User } from "@/models/User";
import { createSessionFamily } from "@/utils/auth/session.server";
import {
  ACCESS_COOKIE,
  APP_STATE_COOKIES,
  LEGACY_COOKIES,
  REFRESH_COOKIE,
  authCookieOptions,
  clearLegacyCookieOptions,
  signAccessToken,
} from "@/utils/auth/tokens";

export async function POST(req: NextRequest) {
  await initDb();
  const reqBody = await req.json()

  const {email, password} = reqBody;
  if (!email || !password) {
    return NextResponse.json({status: 400, message: "a required field is missing"})
  }

  const user = await User.findOne({email});

  if (user === null) {
    return NextResponse.json({status: 404, message: "this email cannot be found"})
  }


  if(user.isActive === false) {
    return NextResponse.json({status: 404, message: "this account has been deleted"})
  }

  // const isMatching = await bcrypt.compare(password, user.passwordHash as string);

  if (password !== user.passwordHash) {
    return NextResponse.json({status: 401, message: "incorrect password"})
  }

  user.lastLogin = new Date();

  await user.save()

  user.password = ''; // not to return this field to the frontend

  // A login starts a brand-new refresh family; `sid` lets logout find it again
  // even if the refresh cookie is missing.
  const { raw, doc } = await createSessionFamily(user._id, req);
  const userToken = signAccessToken({
    _id: String(user._id),
    email: user.email,
    role: user.role,
    sid: String(doc._id),
  });

  const res = NextResponse.json({ user, userToken, status: 200 });
  res.cookies.set(ACCESS_COOKIE, userToken, authCookieOptions);
  res.cookies.set(REFRESH_COOKIE, raw, authCookieOptions);

  // role/email/userId are gone — server components read them off the verified
  // token now. Clear whatever the previous build left in the jar, along with the
  // shift/visit UI-state cookies, which would otherwise leak the PREVIOUS user's
  // open visit to whoever logs in next on this browser.
  for (const name of LEGACY_COOKIES) res.cookies.set(name, "", clearLegacyCookieOptions);
  for (const name of APP_STATE_COOKIES) res.cookies.set(name, "", clearLegacyCookieOptions);

  return res;
}
