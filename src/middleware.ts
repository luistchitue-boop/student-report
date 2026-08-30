import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(_request: NextRequest) {
  // Middleware runs in the Edge runtime, which cannot use the default Prisma client.
  // Keep the app unguarded here and rely on server-side auth checks when needed.
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
