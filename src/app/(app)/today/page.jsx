import { Suspense } from "react";
import TodayClient from "./TodayClient.jsx";

export const metadata = { title: "Today" };

export default function TodayPage() {
  return <Suspense fallback={<div className="boot">Loading…</div>}><TodayClient /></Suspense>;
}
