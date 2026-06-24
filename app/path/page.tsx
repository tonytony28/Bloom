import Link from "next/link";
import type { GrowthStep } from "@/lib/types";
import { PathForm } from "./PathForm";

const fallbackSteps: GrowthStep[] = [
  {
    title: "Pause",
    description: "Take three quiet breaths and name how you want to feel.",
  },
  {
    title: "Choose",
    description: "Pick one meaningful action that feels gentle and real.",
  },
  {
    title: "Reflect",
    description:
      "End the day by noticing what helped and what you want to carry forward.",
  },
];

export default function PathPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900 sm:px-8 lg:px-12">
      <main className="mx-auto flex max-w-5xl flex-col gap-8">
        <Link href="/" className="w-fit text-sm font-medium text-pink-600 transition hover:text-pink-700">
          ← Back home
        </Link>

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-pink-600">
            Path
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            A simple path that makes progress feel visible.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-600">
            Growth does not need to be dramatic to be real. A few steady steps can create a lasting shift.
          </p>
        </section>

        <PathForm fallback={fallbackSteps} />
      </main>
    </div>
  );
}
