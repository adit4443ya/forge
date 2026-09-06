import { notFound } from "next/navigation";
import { loadLab, LAB_INDEX, LAB_TRACKS } from "@/lib/content/labs.js";
import LabRunner from "@/screens/LabRunner.jsx";

export function generateStaticParams() {
  return LAB_INDEX.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const l = LAB_INDEX.find((x) => x.id === id);
  return l ? { title: l.title, description: l.teaser } : {};
}

export default async function LabPage({ params }) {
  const { id } = await params;
  const lab = await loadLab(id);
  if (!lab) notFound();
  const track = LAB_TRACKS.find((t) => t.id === lab.track) || null;
  const idx = LAB_INDEX.findIndex((l) => l.id === id);
  return (
    <LabRunner
      lab={lab}
      track={track}
      prev={idx > 0 ? LAB_INDEX[idx - 1] : null}
      next={idx >= 0 && idx < LAB_INDEX.length - 1 ? LAB_INDEX[idx + 1] : null}
    />
  );
}
