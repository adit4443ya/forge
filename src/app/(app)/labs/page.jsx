import { Suspense } from "react";
import LabsClient from "./LabsClient.jsx";

export const metadata = { title: "Labs" };

export default function LabsPage() {
  return <Suspense fallback={<div className="boot">Loading…</div>}><LabsClient /></Suspense>;
}
