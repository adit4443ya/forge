import { Suspense } from "react";
import PracticeClient from "./PracticeClient.jsx";

export const metadata = { title: "Practice" };

export default function PracticePage() {
  return <Suspense fallback={<div className="boot">Loading…</div>}><PracticeClient /></Suspense>;
}
