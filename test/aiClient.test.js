import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChatCompletionsUrl, interpretAssistantResponse } from '../src/services/aiClient.js';
import { uncertainResponseMessage } from '../src/prompts/proofpilotMentor.js';

function providerPayload(content) {
  return {
    choices: [
      {
        message: {
          content,
        },
      },
    ],
  };
}

test('returns high-confidence JSON answer content', () => {
  const answer = 'Start with five customer interviews and rank the pain by frequency.';

  assert.equal(
    interpretAssistantResponse(providerPayload(JSON.stringify({ confidence: 'high', answer }))),
    answer,
  );
});

test('returns fallback for low-confidence answers', () => {
  assert.equal(
    interpretAssistantResponse(providerPayload(JSON.stringify({ confidence: 'low', answer: uncertainResponseMessage }))),
    uncertainResponseMessage,
  );
});

test('does not reject useful qualified startup advice', () => {
  const answer = 'You could validate this by charging for a concierge MVP before building automation.';

  assert.equal(
    interpretAssistantResponse(providerPayload(JSON.stringify({ confidence: 'high', answer }))),
    answer,
  );
});

test('returns fallback for invalid provider content', () => {
  assert.equal(interpretAssistantResponse(providerPayload('not json')), uncertainResponseMessage);
});

test('builds chat completions URL from provider base URL', () => {
  assert.equal(
    buildChatCompletionsUrl('https://integrate.api.nvidia.com/v1'),
    'https://integrate.api.nvidia.com/v1/chat/completions',
  );
});

test('does not duplicate chat completions path when configured with full endpoint', () => {
  assert.equal(
    buildChatCompletionsUrl('https://api.openai.com/v1/chat/completions'),
    'https://api.openai.com/v1/chat/completions',
  );
});
