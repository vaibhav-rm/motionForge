/**
 * Prompt analysis.
 *
 * Extracts structured intent from a natural-language prompt using a
 * deterministic parser. This runs before any model is consulted, so the
 * same intent is available to every provider — including the offline one.
 */

export interface PromptAnalysis {
  /** Full prompt text. */
  prompt: string;
  /** Explicit duration in seconds, when the prompt states one. */
  durationSeconds: number | null;
  /** Explicit aspect ratio name, when detectable. */
  aspectRatio: string | null;
  /** Explicit frame rate, when stated. */
  fps: number | null;
  /** Detected style names. */
  styles: string[];
  /** Detected palette hints. */
  paletteHints: string[];
  /** Detected subject / topic keywords. */
  topics: string[];
  /** Detected mood words. */
  moods: string[];
  /** Transitions the user explicitly asked for. */
  requestedTransitions: string[];
  /** Whether the user mentioned a title card. */
  wantsTitleCard: boolean;
  /** Whether the user mentioned voiceover / narration. */
  wantsNarration: boolean;
  /** Named entities / quoted phrases worth using as on-screen copy. */
  keyPhrases: string[];
  /** Sentences split from the prompt, useful for beat extraction. */
  sentences: string[];
}

/** Style keywords → canonical style name. */
const STYLE_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(cinematic|cinema|film|filmic|movie)\b/i, "Cinematic"],
  [/\b(minimal(ist)?|clean|simple|understated|swiss)\b/i, "Minimalist"],
  [/\b(documentary|journalis(tic|m)|history|historical)\b/i, "Documentary"],
  [/\b(futur(e|istic)|sci-?fi|scifi|space|spacecraft|alien)\b/i, "Sci-Fi"],
  [/\b(retro|vintage|80s|90s|nostalgic|analog)\b/i, "Retro"],
  [/\b(abstract|experimental|generative|fluid|dreamlike)\b/i, "Abstract"],
  [/\b(geometric|geometric|shapes|polygon|isometric)\b/i, "Geometric"],
  [/\b(editorial|magazine|journal|bold type|large type)\b/i, "Editorial"],
  [/\b(corporate|business|professional|pitch|startup)\b/i, "Corporate"],
  [/\b(scientific|technical|engineering|physics|chemistry|biology)\b/i, "Scientific"],
  [/\b(typograph(y|ic)|kinetic type|kinetic text|lettering)\b/i, "Typography"],
  [/\b(atmospheric|moody|dreamlike|ethereal|haunting)\b/i, "Atmospheric"],
  [/\b(neon|cyberpunk|vaporwave|synthwave)\b/i, "Neon Cyberpunk"],
  [/\b(playful|fun|colorful|vibrant|energetic)\b/i, "Playful"],
  [/\b(monochrome|black and white|grayscale|noir)\b/i, "Monochrome"],
];

/** Colour keywords → canonical palette role. */
const COLOR_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(cyan|teal|turquoise|aqua)\b/i, "cyan"],
  [/\b(blue|navy|azure|cobalt|indigo)\b/i, "blue"],
  [/\b(purple|violet|magenta|lilac)\b/i, "purple"],
  [/\b(pink|rose|coral)\b/i, "pink"],
  [/\b(red|crimson|scarlet|ruby)\b/i, "red"],
  [/\b(orange|amber|gold(en)?)\b/i, "orange"],
  [/\b(yellow|lime|chartreuse)\b/i, "yellow"],
  [/\b(green|emerald|mint|jade)\b/i, "green"],
  [/\b(monochrome|grayscale|greyscale|black and white|noir)\b/i, "monochrome"],
];

/** Topic keywords → the visual archetypes that suit them. */
const TOPIC_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(network|networks|node|nodes|graph|topology|mesh|connected)\b/i, "network"],
  [/\b(processor|cpu|chip|circuit|semiconductor|hardware|silicon|die)\b/i, "processor"],
  [/\b(artificial intelligence|\bai\b|neural|machine learning|model|llm)\b/i, "ai"],
  [/\b(data|chart|graph|statistics|metric|metrics|analytics|growth)\b/i, "data"],
  [/\b(product|launch|advert|advertisement|commercial|brand|promo)\b/i, "product"],
  [/\b(algorithm|code|coding|software|programming|developer|developer)\b/i, "code"],
  [/\b(education|explain|explainer|tutorial|lesson|learn|how .* works)\b/i, "education"],
  [/\b(architecture|system design|infrastructure|pipeline|workflow)\b/i, "architecture"],
  [/\b(team|company|people|human|collaboration|company)\b/i, "team"],
  [/\b(space|planet|galaxy|star|orbit|astronomy)\b/i, "space"],
  [/\b(ocean|water|wave|fluid|liquid|flow)\b/i, "fluid"],
  [/\b(city|urban|architecture|building|skyline)\b/i, "city"],
  [/\b(music|audio|sound|rhythm|beat)\b/i, "music"],
  [/\b(quote|testimonial|interview|review)\b/i, "quote"],
  [/\b(countdown|timer|clock|deadline|launch in)\b/i, "countdown"],
  [/\b(abstract|particles|field|flow|energy)\b/i, "particles"],
];

const MOOD_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(tense|suspense|thriller|dark)\b/i, "tense"],
  [/\b(calm|serene|peaceful|gentle|soft)\b/i, "calm"],
  [/\b(energetic|fast|dynamic|rapid|intense)\b/i, "energetic"],
  [/\b(playful|fun|lighthearted|cheerful)\b/i, "playful"],
  [/\b(epic|grand|sweeping|monumental)\b/i, "epic"],
  [/\b(mysterious|mystery|enigmatic)\b/i, "mysterious"],
  [/\b(optimistic|hopeful|inspiring|uplifting)\b/i, "optimistic"],
  [/\b(clinical|precise|technical|rigorous)\b/i, "clinical"],
  [/\b(warm|cozy|nostalgic)\b/i, "warm"],
];

const TRANSITION_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(cross-?fade|fade (out|in|through|to))\b/i, "fade"],
  [/\b(slide|swipe|push)\b/i, "slideLeft"],
  [/\b(wipe)\b/i, "wipeLeft"],
  [/\b(zoom)\b/i, "zoomBlur"],
  [/\b(cut|hard cut)\b/i, "none"],
];

const ASPECT_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(16:9|widescreen|landscape|youtube)\b/i, "16:9"],
  [/\b(9:16|vertical|reel|shorts|tiktok|story)\b/i, "9:16"],
  [/\b(1:1|square)\b/i, "1:1"],
  [/\b(4:5|portrait|instagram)\b/i, "4:5"],
];

const NUMBER_WORDS: Record<string, number> = {
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fortyfive: 45,
  "forty-five": 45,
  fifty: 50,
  sixty: 60,
  ninety: 90,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
};

/** Extract an explicit duration in seconds from the prompt. */
function parseDuration(prompt: string): number | null {
  // Handles "45 seconds", "45-second", "45s", "45 sec".
  const numeric = prompt.match(
    /\b(\d+(?:\.\d+)?)\s*[-‑]?\s*(?:seconds?|secs?|s)\b/i,
  );
  if (numeric) {
    const value = Number.parseFloat(numeric[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  // Handles "2 minutes", "two minutes".
  const minutes = prompt.match(/\b(\d+(?:\.\d+)?)\s*[-‑]?\s*(?:minutes?|mins?)\b/i);
  if (minutes) {
    const value = Number.parseFloat(minutes[1]);
    if (Number.isFinite(value) && value > 0) return value * 60;
  }

  // Handles "a minute", "two minutes".
  const minuteWord = prompt.match(/\b(a|one|two|three)\s+minutes?\b/i);
  if (minuteWord) {
    const map: Record<string, number> = { a: 1, one: 1, two: 2, three: 3 };
    return (map[minuteWord[1].toLowerCase()] ?? 1) * 60;
  }

  // Word forms: "a thirty-second video", "forty five second".
  const wordMatch = prompt.match(/\b(\w+)[-\s]?(?:second|sec)s?\b/i);
  if (wordMatch) {
    const key = wordMatch[1].toLowerCase();
    if (key in NUMBER_WORDS) return NUMBER_WORDS[key];
  }

  return null;
}

function parseFps(prompt: string): number | null {
  const match = prompt.match(/\b(\d{2,3})\s*fps\b/i);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return [24, 25, 30, 50, 60].includes(value) ? value : null;
}

/** Pull quoted phrases and proper-noun-ish phrases worth using as copy. */
function extractKeyPhrases(prompt: string): string[] {
  const phrases: string[] = [];

  // Quoted strings.
  for (const match of prompt.matchAll(/["'“”']([^"'“”']{2,60})["'“”']/g)) {
    phrases.push(match[1].trim());
  }

  // Capitalised multi-word sequences that are not sentence starts.
  for (const match of prompt.matchAll(
    /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})\b/g,
  )) {
    const phrase = match[1].trim();
    if (!phrases.includes(phrase)) phrases.push(phrase);
  }

  return phrases.filter(Boolean).slice(0, 6);
}

/** Split a prompt into sentence-like beats. */
function splitSentences(prompt: string): string[] {
  return prompt
    .split(/(?<=[.!?;])\s+|\s+—\s+|\s+->\s+|\s+then\s+/i)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 3);
}

/**
 * Analyse a prompt into structured intent.
 */
export function analysePrompt(prompt: string): PromptAnalysis {
  const text = prompt.trim();

  const styles = STYLE_KEYWORDS.filter(([pattern]) => pattern.test(text)).map(
    ([, name]) => name,
  );

  const paletteHints = COLOR_KEYWORDS.filter(([pattern]) =>
    pattern.test(text),
  ).map(([, name]) => name);

  const topics = TOPIC_KEYWORDS.filter(([pattern]) => pattern.test(text)).map(
    ([, name]) => name,
  );

  const moods = MOOD_KEYWORDS.filter(([pattern]) => pattern.test(text)).map(
    ([, name]) => name,
  );

  const requestedTransitions = TRANSITION_KEYWORDS.filter(([pattern]) =>
    pattern.test(text),
  ).map(([, name]) => name);

  const aspectMatch = ASPECT_KEYWORDS.find(([pattern]) => pattern.test(text));

  return {
    prompt: text,
    durationSeconds: parseDuration(text),
    aspectRatio: aspectMatch ? aspectMatch[1] : null,
    fps: parseFps(text),
    styles,
    paletteHints,
    topics,
    moods,
    requestedTransitions,
    wantsTitleCard:
      /\b(title|intro|opening|cover|headline|titling)\b/i.test(text) ||
      text.length < 90,
    wantsNarration: /\b(narrat|voice-?over|voiceover|say|spoken|explain)\b/i.test(text),
    keyPhrases: extractKeyPhrases(text),
    sentences: splitSentences(text),
  };
}
