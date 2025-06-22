import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function middleware(request: NextRequest) {
  // If the current path is /login, skip the middleware
  try {
    if (request.nextUrl.pathname === '/login') {
      return NextResponse.next();
    }

    const cookieStore = await cookies();
    const userToken = cookieStore.get('access_token')?.value;


    if (!userToken) {
      return NextResponse.redirect(new URL('/login', request.url));
      // return NextResponse.json({status: 401, message: "Session has timed out. Please log in to use Mabrook System"})
    }
  
    
    return NextResponse.next();
  } catch (error) {
    // Handle token verification errors
    console.error("Authentication error:", error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - login (excluded because we don't want to protect the login page)
     * - api (optional: exclude API routes if needed)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|login|_next/static|_next/image|favicon.ico).*)',
  ],
};