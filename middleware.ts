import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/owner/:path*", "/booked/:path*", "/bookings/:path*", "/admin/:path*", "/account", "/account/:path*"],
};
