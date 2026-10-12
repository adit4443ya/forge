"use client";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import Machine from "@/screens/Machine.jsx";
import { targetFromParams } from "@/shell/nav.js";

export default function MachineClient() {
  const params = useSearchParams();
  const target = useMemo(() => targetFromParams(params), [params]);
  return <Machine target={target} />;
}
