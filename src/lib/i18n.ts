// Server- and client-safe: constants, types, and the `t()` helper.
// The client-only `useLang` hook lives in `./use-lang.ts`.

export const LANGUAGES = [
    { code: "en", label: "English", bcp47: "en-US" },
    { code: "sw", label: "Kiswahili", bcp47: "sw-KE" },
    { code: "bem", label: "Bemba", bcp47: "bem-ZM" },
    { code: "fr", label: "Français", bcp47: "fr-FR" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

export const LANG_STORAGE_KEY = "bloom_lang";

// One central dictionary. Bemba and Kiswahili translations are best-effort
// starters — the data/research teammate should review with native speakers.
export const DICT = {
    en: {
        tagline: "Discover what you love",
        chooseLanguage: "Choose your language",
        begin: "Let's Begin",
        // Discover screen
        discoverGreeting: "Hello. I'm Bloom. What do you love doing?",
        typeOrSpeak: "Type your answer, or tap the mic to speak",
        sendBtn: "Send",
        listening: "Listening…",
        micStart: "Tap to speak",
        micStop: "Stop",
        thinking: "Bloom is thinking…",
        voiceUnsupported: "Voice input is not supported in this browser.",
        // Path screen
        yourPassion: "Your passion",
        learnLabel: "Start learning",
        opportunitiesLabel: "Opportunities near you",
        backHome: "Start over",
        noOpportunities:
            "We don't have specific opportunities listed yet — explore the learning topics and check back soon.",
        visitSite: "Visit",
        pathLoading: "Shaping your path…",
        pathError:
            "Bloom couldn't shape your path just now. Please go back and try again.",
    },
    sw: {
        tagline: "Gundua unachopenda",
        chooseLanguage: "Chagua lugha yako",
        begin: "Twende",
        discoverGreeting: "Habari. Mimi ni Bloom. Unapenda kufanya nini?",
        typeOrSpeak: "Andika jibu lako, au gusa kipaza sauti uongee",
        sendBtn: "Tuma",
        listening: "Ninasikiliza…",
        micStart: "Gusa kuongea",
        micStop: "Simama",
        thinking: "Bloom anafikiria…",
        voiceUnsupported: "Sauti haitumiki kwenye kivinjari hiki.",
        yourPassion: "Shauku yako",
        learnLabel: "Anza kujifunza",
        opportunitiesLabel: "Fursa karibu nawe",
        backHome: "Anza upya",
        noOpportunities:
            "Hatuna fursa mahususi bado — angalia mada za kujifunza na urudi tena hivi karibuni.",
        visitSite: "Tembelea",
        pathLoading: "Tunaandaa njia yako…",
        pathError: "Bloom hakuweza kuandaa njia sasa hivi. Tafadhali jaribu tena.",
    },
    bem: {
        tagline: "Sanga ico utemwa",
        chooseLanguage: "Sala ululimi lobe",
        begin: "Tatampuleni",
        discoverGreeting: "Mwapoleni. Nine Bloom. Cinshi mutemwa ukucita?",
        typeOrSpeak: "Lemba ifyo wayasuka, nelyo kanya pa maiki ulande",
        sendBtn: "Tuma",
        listening: "Nalekutika…",
        micStart: "Kanya ulande",
        micStop: "Imika",
        thinking: "Bloom aletontonkanya…",
        voiceUnsupported: "Ishiwi talyabombela muli iyi browser.",
        yourPassion: "Icikutemwa",
        learnLabel: "Tendeka ukusambilila",
        opportunitiesLabel: "Inshila shapepi nobe",
        backHome: "Tampaibili",
        noOpportunities:
            "Tatwakwete inshila shaibela nomba — mona ifyakusambilila kabili wisepo nakabili.",
        visitSite: "Endela",
        pathLoading: "Tulepekanya inshila yobe…",
        pathError: "Bloom tapakapekanye inshila nomba. Mwesha nakabili.",
    },
    fr: {
        tagline: "Découvre ce que tu aimes",
        chooseLanguage: "Choisis ta langue",
        begin: "Commençons",
        discoverGreeting: "Bonjour. Je suis Bloom. Qu'aimes-tu faire ?",
        typeOrSpeak: "Écris ta réponse, ou touche le micro pour parler",
        sendBtn: "Envoyer",
        listening: "J'écoute…",
        micStart: "Touche pour parler",
        micStop: "Stop",
        thinking: "Bloom réfléchit…",
        voiceUnsupported: "La saisie vocale n'est pas prise en charge ici.",
        yourPassion: "Ta passion",
        learnLabel: "Commence à apprendre",
        opportunitiesLabel: "Opportunités près de toi",
        backHome: "Recommencer",
        noOpportunities:
            "Pas encore d'opportunités spécifiques — explore les sujets d'apprentissage et reviens bientôt.",
        visitSite: "Visiter",
        pathLoading: "Bloom prépare ton chemin…",
        pathError:
            "Bloom n'a pas pu préparer ton chemin. Reviens en arrière et réessaie.",
    },
} as const satisfies Record<LangCode, Record<string, string>>;

export type DictKey = keyof typeof DICT["en"];

export function t(lang: LangCode, key: DictKey): string {
    return DICT[lang]?.[key] ?? DICT.en[key];
}
