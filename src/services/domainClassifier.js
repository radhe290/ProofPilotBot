const supportedKeywordGroups = [
  ['startup', 'startups', 'founder', 'founders', 'entrepreneur', 'entrepreneurship', 'venture', 'seed round', 'fundraising'],
  ['business', 'business model', 'revenue', 'pricing', 'go-to-market', 'gtm', 'strategy', 'operations'],
  ['mvp', 'minimum viable product', 'prototype', 'product validation', 'customer validation', 'validation'],
  ['market research', 'competitor', 'competition', 'market sizing', 'segmentation', 'positioning'],
  ['pitch', 'pitch deck', 'deck', 'investor', 'investors', 'pitching', 'demo day'],
  ['hackathon', 'hackathons', 'demo', 'prototype challenge'],
  ['proofpilot', 'evidence validation', 'credibility', 'proof', 'signals', 'proof of concept'],
];

const unsupportedKeywordGroups = [
  ['weather', 'forecast', 'temperature', 'rain', 'snow'],
  ['sports', 'football', 'basketball', 'soccer', 'baseball', 'tennis', 'cricket'],
  ['movie', 'movies', 'film', 'tv show', 'show recommendation', 'celebrity'],
  ['politics', 'election', 'government', 'senate', 'congress', 'policy debate'],
  ['joke', 'jokes', 'funny', 'riddle', 'meme'],
  ['relationship', 'dating', 'breakup', 'personal advice', 'therapy', 'mental health'],
];

function normalizeMessage(message) {
  return message.toLowerCase().replace(/[^a-z0-9+\s-]/g, ' ');
}

function keywordPattern(keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
}

function includesAny(normalizedMessage, keywords) {
  return keywords.some((keyword) => keywordPattern(keyword).test(normalizedMessage));
}

export function classifyProofPilotDomain(message) {
  const normalizedMessage = normalizeMessage(message);

  const supportedHit = supportedKeywordGroups.some((group) => includesAny(normalizedMessage, group));
  const unsupportedHit = unsupportedKeywordGroups.some((group) => includesAny(normalizedMessage, group));

  if (supportedHit) {
    return {
      supported: true,
      reason: unsupportedHit ? 'matched startup domain with adjacent unsupported keyword' : 'matched supported startup domain',
    };
  }

  if (unsupportedHit) {
    return { supported: false, reason: 'explicitly unsupported topic' };
  }

  if (/\bcoding\b|\bcode\b|\bprogramming\b|\bjavascript\b|\bpython\b|\breact\b|\bnode\b/.test(normalizedMessage)) {
    return {
      supported: /startup|founder|mvp|pitch|market|proofpilot|validation|investor|product/.test(normalizedMessage),
      reason: 'coding requires startup context',
    };
  }

  return { supported: false, reason: 'no supported domain match' };
}
