import { Suspense } from "react";
import AppShell from "@/shell/AppShell.jsx";

export default function AppLayout({ children }) {
  return (
    <Suspense fallback={<div className="boot">Loading…</div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
