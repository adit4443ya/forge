import { Suspense } from "react";
import LabsClient from "./LabsClient.jsx";

export const metadata = {
  title: "Labs",
  description: "Guided labs you run on your own machine: perf counters, cache behaviour, codegen, concurrency, syscalls, AArch64 and SVE. Each lab shows the command to run and the output it produced, so you compare against a real number.",
  alternates: { canonical: "/labs" },
};

export default function LabsPage() {
  return <Suspense fallback={<div className="boot">Loading…</div>}><LabsClient /></Suspense>;
}
