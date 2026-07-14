const CREDIBLE_SOURCES = [
  {
    topic: 'health',
    keywords: ['health', 'medicine', 'medical', 'disease', 'doctor', 'nutrition', 'covid', 'vaccine'],
    sources: [
      { title: 'National Institutes of Health', url: 'https://www.nih.gov/' },
      { title: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/' },
      { title: 'World Health Organization', url: 'https://www.who.int/' },
    ],
  },
  {
    topic: 'finance',
    keywords: ['stock', 'investing', 'loan', 'credit', 'crypto', 'finance', 'bank', 'mortgage'],
    sources: [
      { title: 'Investor.gov', url: 'https://www.investor.gov/' },
      { title: 'Consumer Financial Protection Bureau', url: 'https://www.consumerfinance.gov/' },
      { title: 'U.S. Securities and Exchange Commission', url: 'https://www.sec.gov/' },
    ],
  },
  {
    topic: 'law',
    keywords: ['law', 'legal', 'court', 'lawsuit', 'rights', 'contract', 'policy'],
    sources: [
      { title: 'Legal Information Institute', url: 'https://www.law.cornell.edu/' },
      { title: 'Justia', url: 'https://www.justia.com/' },
      { title: 'GovInfo', url: 'https://www.govinfo.gov/' },
    ],
  },
  {
    topic: 'science',
    keywords: ['study', 'research', 'science', 'climate', 'space', 'biology', 'physics'],
    sources: [
      { title: 'Google Scholar', url: 'https://scholar.google.com/' },
      { title: 'Nature', url: 'https://www.nature.com/' },
      { title: 'ScienceDirect', url: 'https://www.sciencedirect.com/' },
    ],
  },
  {
    topic: 'news',
    keywords: ['election', 'war', 'government', 'breaking', 'politics', 'news'],
    sources: [
      { title: 'Associated Press', url: 'https://apnews.com/' },
      { title: 'Reuters', url: 'https://www.reuters.com/' },
      { title: 'BBC News', url: 'https://www.bbc.com/news' },
    ],
  },
];

const checkerDefinitions = [
  {
    id: 'stylometry',
    label: 'Stylometry Checker',
    run(features) {
      const uniformitySignal = clamp(1 - features.sentenceLengthStdDev / 14);
      const longSentenceSignal = clamp((features.averageSentenceLength - 18) / 12);
      return {
        score: clamp(uniformitySignal * 0.65 + longSentenceSignal * 0.35),
        evidence: [
          'Sentence lengths are unusually even.',
          'Average sentence length resembles generated explainer text.',
        ],
      };
    },
  },
  {
    id: 'burstiness',
    label: 'Burstiness Checker',
    run(features) {
      const lowBurstiness = clamp(1 - features.burstiness);
      const paragraphSignal = clamp(features.averageParagraphLength / 120);
      return {
        score: clamp(lowBurstiness * 0.75 + paragraphSignal * 0.25),
        evidence: [
          'Paragraph rhythm has low burstiness.',
          'Paragraphs follow a similar informational cadence.',
        ],
      };
    },
  },
  {
    id: 'repetition',
    label: 'Repetition Checker',
    run(features) {
      const repetitionSignal = clamp(features.repeatedPhraseRatio * 8);
      const transitionSignal = clamp(features.aiTransitionRatio * 10);
      return {
        score: clamp(repetitionSignal * 0.7 + transitionSignal * 0.3),
        evidence: [
          'Repeated phrasing or templated transitions were detected.',
          'Some wording resembles common generated article patterns.',
        ],
      };
    },
  },
];

export async function runAiCheckers({ text, title = '', url = '' }) {
  const features = analyzeText(text);
  const checkerResults = checkerDefinitions.map((checker) => {
    const result = checker.run(features);

    return {
      id: checker.id,
      label: checker.label,
      score: round(result.score),
      evidence: result.evidence,
    };
  });

  const aggregateScore = round(
    checkerResults.reduce((sum, result) => sum + result.score, 0) / checkerResults.length,
  );

  return {
    verdict: aggregateScore >= 0.72 ? 'likely_ai' : aggregateScore >= 0.5 ? 'uncertain' : 'likely_human',
    aiProbability: aggregateScore,
    confidence: confidenceFromScore(aggregateScore),
    checkers: checkerResults,
    recommendedSources: recommendSources(`${title} ${url} ${text}`),
    features,
  };
}

export function analyzeText(text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const sentences = splitSentences(normalized);
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const words = normalized.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  const sentenceLengths = sentences.map((sentence) => (sentence.match(/[a-z0-9']+/gi) ?? []).length);
  const averageSentenceLength = average(sentenceLengths);
  const sentenceLengthStdDev = stdDev(sentenceLengths);
  const paragraphLengths = paragraphs.map((paragraph) => (paragraph.match(/[a-z0-9']+/gi) ?? []).length);
  const averageParagraphLength = average(paragraphLengths);
  const repeatedPhraseRatio = repeatedTrigramRatio(words);
  const aiTransitionRatio = countAiTransitions(normalized) / Math.max(sentences.length, 1);

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    averageSentenceLength: round(averageSentenceLength),
    sentenceLengthStdDev: round(sentenceLengthStdDev),
    burstiness: round(sentenceLengthStdDev / Math.max(averageSentenceLength, 1)),
    averageParagraphLength: round(averageParagraphLength),
    repeatedPhraseRatio: round(repeatedPhraseRatio),
    aiTransitionRatio: round(aiTransitionRatio),
  };
}

function recommendSources(content) {
  const lowerContent = content.toLowerCase();
  const topic = CREDIBLE_SOURCES.find((candidate) =>
    candidate.keywords.some((keyword) => lowerContent.includes(keyword)),
  );

  if (topic) return topic.sources;

  return [
    { title: 'Google Scholar', url: 'https://scholar.google.com/' },
    { title: 'Associated Press', url: 'https://apnews.com/' },
    { title: 'Reuters', url: 'https://www.reuters.com/' },
  ];
}

function splitSentences(text) {
  return text.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean);
}

function repeatedTrigramRatio(words) {
  if (words.length < 6) return 0;

  const seen = new Set();
  let repeated = 0;

  for (let index = 0; index < words.length - 2; index += 1) {
    const phrase = `${words[index]} ${words[index + 1]} ${words[index + 2]}`;
    if (seen.has(phrase)) repeated += 1;
    seen.add(phrase);
  }

  return repeated / Math.max(words.length - 2, 1);
}

function countAiTransitions(text) {
  const transitions = [
    'in today\'s digital age',
    'it is important to note',
    'delve into',
    'in conclusion',
    'moreover',
    'furthermore',
    'as a result',
    'when it comes to',
  ];

  return transitions.reduce((count, phrase) => {
    return count + (text.toLowerCase().match(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'g')) ?? []).length;
  }, 0);
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values) {
  if (values.length <= 1) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function confidenceFromScore(score) {
  if (score >= 0.78 || score <= 0.22) return 'high';
  if (score >= 0.65 || score <= 0.35) return 'medium';
  return 'low';
}

function clamp(value) {
  return Math.min(Math.max(value, 0), 1);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
