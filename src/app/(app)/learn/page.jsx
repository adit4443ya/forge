import { Suspense } from "react";
import LearnClient from "./LearnClient.jsx";

export const metadata = { title: "Learn" };

export default function LearnPage() {
  return <Suspense fallback={<div className="boot">Loading…</div>}><LearnClient /></Suspense>;
}
