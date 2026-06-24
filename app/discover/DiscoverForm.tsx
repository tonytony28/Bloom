"use client";

import { useActionState } from "react";
import type { ReflectionPrompt } from "@/lib/types";
import { suggestPrompts, type PromptsState } from "./actions";

const initialPromptsState: PromptsState = {
  prompts: [],
  error: null,
  feeling: "",
};

export function DiscoverForm({ fallback }: { fallback: ReflectionPrompt[] }) {
  const [state, formAction, pending] = useActionState(
    suggestPrompts,
    initialPromptsState
  );

  const prompts = state.prompts.length > 0 ? state.prompts : fallback;
  const isPersonalized = state.prompts.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-3">
        <label
          htmlFor="feeling"
          className="text-sm font-medium text-zinc-700"
        >
          How are you feeling right now?
        </label>
        <textarea
          id="feeling"
          name="feeling"
          rows={3}
          defaultValue={state.feeling}
          placeholder="A few words are enough — restless, hopeful, tired, unsure…"
          className="w-full resize-none rounded-2xl border border-zinc-300 bg-white px-5 py-4 text-zinc-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Gently gathering…" : "Offer me prompts"}
        </button>
        {state.error ? (
          <p className="text-sm text-rose-600">{state.error}</p>
        ) : null}
      </form>

      <section className="grid gap-4 md:grid-cols-3">
        {prompts.map((prompt) => (
          <article
            key={prompt.title}
            className="rounded-[1.25rem] border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-zinc-950">
              {prompt.title}
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600">
              {prompt.prompt}
            </p>
          </article>
        ))}
      </section>

      <p className="text-sm text-zinc-500">
        {isPersonalized
          ? "Prompts shaped around what you shared. Sit with whichever one feels most alive."
          : "A few prompts to begin with — or share how you're feeling for ones made just for you."}
      </p>
    </div>
  );
}
