import { Suspense } from "react";
import PracticeClient from "./PracticeClient.jsx";

export const metadata = {
  title: "Practice",
  description: "Timed coding problems with staged hints, pattern cheat sheets linked to the problems that need them, C++ internals, rapid-fire mechanism questions, estimation, mental math and mock interview formats.",
  alternates: { canonical: "/practice" },
};

export default function PracticePage() {
  return <Suspense fallback={<div className="boot">Loading…</div>}><PracticeClient /></Suspense>;
}
