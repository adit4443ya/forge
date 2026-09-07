import { Suspense } from "react";
import TodayClient from "./TodayClient.jsx";

export const metadata = {
  title: "Today",
  description: "A session shaped for the role you are preparing for: a timed problem set, the labs and guides that match today's competency, and rapid-recall questions due for review.",
  alternates: { canonical: "/today" },
};

export default function TodayPage() {
  return <Suspense fallback={<div className="boot">Loading…</div>}><TodayClient /></Suspense>;
}
