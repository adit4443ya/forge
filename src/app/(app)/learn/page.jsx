import { Suspense } from "react";
import LearnClient from "./LearnClient.jsx";

export const metadata = {
  title: "Learn",
  description: "Long-form guides on LLVM and compiler infrastructure, C++ internals, microarchitecture, concurrency and low-latency systems, wired to a coverage map that shows what you have actually practised.",
  alternates: { canonical: "/learn" },
};

export default function LearnPage() {
  return <Suspense fallback={<div className="boot">Loading…</div>}><LearnClient /></Suspense>;
}
