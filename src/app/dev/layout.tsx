import { notFound } from "next/navigation";

/**
 * Keeps /dev/* out of production.
 *
 * NODE_ENV is inlined at build time, so the pages below are unreachable in a
 * production build rather than merely hidden - the check cannot be flipped by
 * a request header or an environment variable set on the host.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
