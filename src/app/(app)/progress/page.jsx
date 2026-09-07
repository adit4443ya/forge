import { Suspense } from "react";
import ProgressClient from "./ProgressClient.jsx";

export const metadata = {
  title: "Progress",
  description: "What you have covered, what is due for review, and where the gaps are — with a JSON export you can take anywhere.",
  alternates: { canonical: "/progress", },
  robots: { index: false },
};

export default function ProgressPage() {
  return <Suspense fallback={<div className="boot">Loading…</div>}><ProgressClient /></Suspense>;
}
