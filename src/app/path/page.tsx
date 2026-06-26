import Link from "next/link";
import { generateLearningTopics } from "@/src/lib/claude";
import { findOpportunities } from "@/src/lib/opportunities";
import { DICT, type LangCode } from "@/src/lib/i18n";
import {
  PASSION_CATEGORIES,
  REGIONS,
  type LearningTopic,
  type Opportunity,
  type PassionCategory,
  type Region,
} from "@/src/lib/types";
import { ShareActions } from "./ShareActions";

type SearchParams = Record<string, string | string[] | undefined>;

function pickOne(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function asLang(value: string): LangCode {
  const known: LangCode[] = ["en", "sw", "bem", "fr"];
  return (known as string[]).includes(value) ? (value as LangCode) : "en";
}

function asCategory(value: string): PassionCategory | null {
  return (PASSION_CATEGORIES as readonly string[]).includes(value)
    ? (value as PassionCategory)
    : null;
}

function inferRegion(lang: LangCode, explicit: string): Region {
  if ((REGIONS as readonly string[]).includes(explicit)) {
    return explicit as Region;
  }
  switch (lang) {
    case "sw":
      return "kenya";
    case "bem":
      return "zambia";
    default:
      return "general";
  }
}

type PathPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function PathPage({ searchParams }: PathPageProps) {
  const params = await searchParams;
  const lang = asLang(pickOne(params.lang));
  const passion = pickOne(params.passion);
  const summary = pickOne(params.summary);
  const category = asCategory(pickOne(params.category));
  const region = inferRegion(lang, pickOne(params.region));
  const dict = DICT[lang];

  if (!passion || !category) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-pink-50 via-rose-50 to-amber-50 px-6 text-center text-zinc-700">
        <div className="max-w-md">
          <p className="text-lg">{dict.pathError}</p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            {dict.backHome}
          </Link>
        </div>
      </div>
    );
  }

  let topics: LearningTopic[] = [];
  let topicsError: string | null = null;
  try {
    topics = await generateLearningTopics(passion, category, lang);
  } catch (err) {
    topicsError = err instanceof Error ? err.message : "Unknown error";
  }

  const opportunities: Opportunity[] = findOpportunities(category, region, 3);

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-rose-50 to-amber-50 px-5 py-8 text-zinc-900 sm:px-8">
      <main className="mx-auto flex max-w-md flex-col gap-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-600">
            {dict.yourPassion}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            {passion}
          </h1>
          {summary ? (
            <p className="mt-3 text-base leading-7 text-zinc-600">{summary}</p>
          ) : null}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-600">
            {dict.learnLabel}
          </h2>
          {topicsError ? (
            <p className="mt-4 text-sm text-rose-600">{topicsError}</p>
          ) : (
            <ol className="mt-4 space-y-4">
              {topics.map((topic, i) => (
                <li key={`${topic.title}-${i}`} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-100 text-sm font-semibold text-pink-700">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-950">
                      {topic.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">
                      {topic.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-600">
            {dict.opportunitiesLabel}
          </h2>
          {opportunities.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              {dict.noOpportunities}
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {opportunities.map((opp) => (
                <li key={opp.id}>
                  <a
                    href={opp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-2xl border border-zinc-100 p-4 transition hover:border-pink-200 hover:bg-pink-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-zinc-950">
                        {opp.name}
                      </h3>
                      <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-pink-700">
                        {opp.kind}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      {opp.description}
                    </p>
                    <span className="mt-2 inline-block text-xs font-medium text-pink-600">
                      {dict.visitSite} →
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ShareActions lang={lang} passion={passion} summary={summary} />

        <Link
          href="/"
          className="mx-auto rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
        >
          {dict.backHome}
        </Link>
      </main>
    </div>
  );
}
