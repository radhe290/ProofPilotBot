import './loadEnv.js';
import { proofpilotMentorPrompt } from './prompts/proofpilotMentor.js';

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'null',
];

function parseAllowedOrigins(value) {
  if (!value) {
    return defaultAllowedOrigins;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function normalizeApiKey(value) {
  const apiKey = value?.trim() || '';

  if (!apiKey || apiKey === 'your_api_key_here') {
    return '';
  }

  return apiKey;
}

export const config = {
  provider: process.env.AI_PROVIDER || 'openai-compatible',
  baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
  apiKey: normalizeApiKey(process.env.AI_API_KEY),
  model: process.env.AI_MODEL || 'gpt-4o-mini',
  providerTimeoutMs: Number(process.env.AI_TIMEOUT_MS) || 45_000,
  allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 20,
  systemPrompt:
    process.env.AI_SYSTEM_PROMPT ||
    proofpilotMentorPrompt,
};

export function getProviderConfiguration() {
  return {
    provider: config.provider,
    baseUrl: config.baseUrl.replace(/\/$/, ''),
    apiKey: config.apiKey,
    model: config.model,
    providerTimeoutMs: config.providerTimeoutMs,
    systemPrompt: config.systemPrompt,
  };
}

export function getHttpConfiguration() {
  return {
    allowedOrigins: config.allowedOrigins,
    rateLimitWindowMs: config.rateLimitWindowMs,
    rateLimitMaxRequests: config.rateLimitMaxRequests,
  };
}
