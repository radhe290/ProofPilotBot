import { getProviderConfiguration } from '../config.js';
import { uncertainResponseMessage } from '../prompts/proofpilotMentor.js';

function buildProviderError(message, statusCode = 500, expose = true) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = expose;
  return error;
}

function redactSensitiveProviderText(value) {
  return String(value).replace(/\b[A-Za-z0-9_-]*api-[A-Za-z0-9_-]+\b/g, '[redacted-api-key]');
}

export function buildChatCompletionsUrl(baseUrl) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  if (normalizedBaseUrl.endsWith('/chat/completions')) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}/chat/completions`;
}

export function interpretAssistantResponse(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content !== 'string' || !content.trim()) {
    return uncertainResponseMessage;
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return uncertainResponseMessage;
  }

  if (!parsed || typeof parsed !== 'object') {
    return uncertainResponseMessage;
  }

  const confidence = typeof parsed.confidence === 'string' ? parsed.confidence.toLowerCase() : '';
  const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : '';

  if (confidence !== 'high' || !answer) {
    return uncertainResponseMessage;
  }

  if (answer === uncertainResponseMessage) {
    return uncertainResponseMessage;
  }

  return answer;
}

export async function sendChatToProvider(message) {
  const { provider, baseUrl, apiKey, model, providerTimeoutMs, systemPrompt } = getProviderConfiguration();

  if (!message || !message.trim()) {
    throw buildProviderError('Message is required.', 400);
  }

  if (provider !== 'openai-compatible') {
    throw buildProviderError(`Unsupported AI provider: ${provider}`, 500);
  }

  if (!apiKey) {
    throw buildProviderError('ProofPilot is temporarily unavailable. Please try again shortly.', 503);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), providerTimeoutMs);

  let response;
  const chatCompletionsUrl = buildChatCompletionsUrl(baseUrl);

  try {
    response = await fetch(chatCompletionsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message.trim() },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw buildProviderError('The AI service took too long to respond. Please try again in a moment.', 504);
    }

    throw buildProviderError('ProofPilot could not reach the AI service. Please try again in a moment.', 503);
  } finally {
    clearTimeout(timeoutId);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw buildProviderError('AI provider returned an invalid response.', 502);
  }

  if (!response.ok) {
    const providerMessage = payload?.error?.message || payload?.message || 'ProofPilot received an unexpected response from the AI service.';
    const statusCode = response.status === 408 || response.status === 504 ? 504 : response.status >= 500 ? 502 : response.status;
    const providerUrl = new URL(chatCompletionsUrl);
    console.error(
      `AI provider error (${response.status} ${response.statusText}) at ${providerUrl.origin}${providerUrl.pathname}:`,
      redactSensitiveProviderText(providerMessage),
    );

    if (response.status === 405) {
      throw buildProviderError(
        'The AI provider rejected the chat request method. Check AI_BASE_URL and AI_MODEL in .env.',
        405,
      );
    }

    throw buildProviderError('ProofPilot could not complete the request. Please try again in a moment.', statusCode);
  }

  return interpretAssistantResponse(payload);
}
