import { redirect } from "next/navigation";

/**
 * Landing route. The app is dashboard-first, so `/` simply forwards to
 * `/dashboard`; the proxy then redirects to `/login` if the user is signed out
 * (and LOCAL_MODE skips that entirely).
 */
export default function Home() {
  redirect("/dashboard");
}
