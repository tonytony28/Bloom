"use client";

import { useActionState } from "react";
import type { GrowthStep } from "@/lib/types";
import { suggestPath, type PathState } from "./actions";

const initialPathState: PathState = {
  path: null,
  error: null,
  intention: "",
};

export function PathForm({ fallback }: { fallback: GrowthStep[] }) {
  const [state, formAction, pending] = useActionState(
    suggestPath,
    initialPathState
  );

  const steps = state.path?.steps ?? fallback;

  return (
    <div className="flex flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-3">
        <label
          htmlFor="intention"
          className="text-sm font-medium text-zinc-700"
        >
          What would you like to gently work toward today?
        </label>
        <input
          id="intention"
          name="intention"
          defaultValue={state.intention}
          placeholder="e.g. feel calmer, reconnect with a friend, move my body"
          className="w-full rounded-full border border-zinc-300 bg-white px-5 py-3 text-zinc-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Tending your path…" : "Grow my path"}
        </button>
        {state.error ? (
          <p className="text-sm text-rose-600">{state.error}</p>
        ) : null}
      </form>

      {state.path?.encouragement ? (
        <p className="rounded-[1.25rem] border border-pink-100 bg-pink-50 px-6 py-4 text-sm leading-7 text-pink-800">
          {state.path.encouragement}
        </p>
      ) : null}

      <section className="space-y-4">
        {steps.map((step, index) => (
          <article
            key={`${step.title}-${index}`}
            className="flex gap-4 rounded-[1.25rem] border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-sm font-semibold text-pink-700">
              {index + 1}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">
                {step.title}
              </h2>
              <p className="mt-2 text-sm leading-7 text-zinc-600">
                {step.description}
              </p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
