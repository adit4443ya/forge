import AppShell from "@/shell/AppShell.jsx";

/* No Suspense here on purpose. Each client screen wraps itself, and AppShell
   wraps its own search-param read — keeping the boundary off `children` is
   what lets a page's structured data survive into the served HTML. */
export default function AppLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
