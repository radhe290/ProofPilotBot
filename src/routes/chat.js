import { sendChatToProvider } from '../services/aiClient.js';
import { classifyProofPilotDomain } from '../services/domainClassifier.js';

const outsideScopeResponse =
  'This assistant is specialized in startup mentoring, business strategy, pitching, and evidence validation. Your question falls outside its supported scope.';

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(Object.assign(new Error('Request body too large.'), { statusCode: 413 }));
        request.destroy();
      }
    });

    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body.'), { statusCode: 400 }));
      }
    });

    request.on('error', () => {
      reject(Object.assign(new Error('Failed to read request body.'), { statusCode: 400 }));
    });
  });
}

export async function handleChatRequest(request, response, sendJson) {
  try {
    const body = await readJsonBody(request);
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!message) {
      sendJson(response, 400, { error: 'message is required' });
      return;
    }

    if (message.length > 4000) {
      sendJson(response, 400, { error: 'message is too long' });
      return;
    }

    const domainCheck = classifyProofPilotDomain(message);
    if (!domainCheck.supported) {
      sendJson(response, 200, { assistantResponse: outsideScopeResponse });
      return;
    }

    const assistantResponse = await sendChatToProvider(message);
    sendJson(response, 200, { assistantResponse });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = error.expose === false ? 'Failed to process chat request.' : error.message;
    sendJson(response, statusCode, { error: message });
  }
}
