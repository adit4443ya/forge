import { Suspense } from "react";
import ProgressClient from "./ProgressClient.jsx";

export const metadata = { title: "Progress" };

export default function ProgressPage() {
  return <Suspense fallback={<div className="boot">Loading…</div>}><ProgressClient /></Suspense>;
}
