"use client";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import Today from "@/screens/Today.jsx";
import { targetFromParams } from "@/shell/nav.js";
import { useProgress } from "@/lib/progress/store.js";
import { ROLE_BY_ID, ROLES } from "@/data/roles.js";

export default function TodayClient() {
  const params = useSearchParams();
  const prog = useProgress();
  const target = useMemo(() => targetFromParams(params), [params]);
  const role = ROLE_BY_ID[prog.role] || ROLES[0];
  return <Today role={role} target={target} />;
}
