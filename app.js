const messageList = document.getElementById('messageList');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const sendButton = chatForm.querySelector('.send-button');
const loadingBar = document.getElementById('loadingBar');
const starterPrompts = document.getElementById('starterPrompts');
const chatNotice = document.getElementById('chatNotice');
const messageTemplate = document.getElementById('messageTemplate');
const loadingTemplate = document.getElementById('loadingTemplate');
const apiBaseUrl = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
const chatEndpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/chat`;
const requestTimeoutMs = 60000;
let noticeTimerId = null;

const initialMessages = [
  {
    role: 'assistant',
    text: 'Welcome to ProofPilot. Ask about startup ideas, validation, market research, pitching, MVP planning, or evidence you want to strengthen.',
  },
];

function createMessageElement(role, text) {
  const node = messageTemplate.content.firstElementChild.cloneNode(true);
  node.classList.add(role);

  const bubble = node.querySelector('.message-bubble');

  if (role === 'assistant') {
    bubble.classList.add('message-bubble--assistant');
    bubble.innerHTML = `
      <div class="message-meta">
        <span class="message-role">ProofPilot</span>
        <button class="copy-button" type="button">Copy response</button>
      </div>
      <div class="message-content markdown-content">${renderMarkdown(text)}</div>
    `;

    const copyButton = bubble.querySelector('.copy-button');
    copyButton.addEventListener('click', async () => {
      const originalLabel = copyButton.textContent;
      try {
        await copyTextToClipboard(text);
        copyButton.textContent = 'Copied';
        copyButton.classList.add('is-copied');
      } catch {
        copyButton.textContent = 'Copy failed';
      }

      window.setTimeout(() => {
        copyButton.textContent = originalLabel;
        copyButton.classList.remove('is-copied');
      }, 1500);
    });
  } else {
    bubble.innerHTML = '<p class="message-text"></p>';
    bubble.querySelector('.message-text').textContent = text;
  }

  return node;
}

function createLoadingElement() {
  return loadingTemplate.content.firstElementChild.cloneNode(true);
}

function showNotice(message) {
  if (!chatNotice) {
    return;
  }

  if (noticeTimerId) {
    window.clearTimeout(noticeTimerId);
  }

  chatNotice.textContent = message;
  chatNotice.hidden = false;

  noticeTimerId = window.setTimeout(() => {
    chatNotice.hidden = true;
    chatNotice.textContent = '';
  }, 4000);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInlineMarkdown(value) {
  const escaped = escapeHtml(value);

  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
}

function renderMarkdownBlocks(value) {
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }

    blocks.push(`<p>${formatInlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length || !listType) {
      return;
    }

    blocks.push(`<${listType}>${listItems.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join('')}</${listType}>`);
    listItems = [];
    listType = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push(`<h${headingMatch[1].length}>${formatInlineMarkdown(headingMatch[2])}</h${headingMatch[1].length}>`);
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      if (listType && listType !== 'ul') {
        flushList();
      }
      listType = 'ul';
      listItems.push(bulletMatch[1]);
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== 'ol') {
        flushList();
      }
      listType = 'ol';
      listItems.push(orderedMatch[1]);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks.join('');
}

function renderMarkdown(value) {
  const fencePattern = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let output = '';
  let match;

  while ((match = fencePattern.exec(value)) !== null) {
    const before = value.slice(lastIndex, match.index);
    output += renderMarkdownBlocks(before);

    const language = match[1].trim();
    const code = escapeHtml(match[2].replace(/\n$/, ''));
    const languageLabel = language ? `Code - ${escapeHtml(language)}` : 'Code';

    output += `
      <figure class="code-block">
        <div class="code-block__header">
          <span>${languageLabel}</span>
        </div>
        <pre><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${code}</code></pre>
      </figure>
    `;

    lastIndex = match.index + match[0].length;
  }

  output += renderMarkdownBlocks(value.slice(lastIndex));
  return output || `<p>${formatInlineMarkdown(value)}</p>`;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const fallback = document.createElement('textarea');
  fallback.value = text;
  fallback.setAttribute('readonly', 'true');
  fallback.style.position = 'fixed';
  fallback.style.opacity = '0';
  document.body.appendChild(fallback);
  fallback.select();
  document.execCommand('copy');
  fallback.remove();
}

function scrollToBottom() {
  messageList.scrollTo({
    top: messageList.scrollHeight,
    behavior: 'smooth',
  });
}

function renderInitialMessages() {
  initialMessages.forEach((message) => {
    messageList.appendChild(createMessageElement(message.role, message.text));
  });
  scrollToBottom();
}

function autoResizeInput() {
  chatInput.style.height = 'auto';
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 160)}px`;
}

function setLoadingState(isLoading) {
  loadingBar.hidden = !isLoading;
  chatInput.disabled = isLoading;
  sendButton.disabled = isLoading;
}

function hideStarterPrompts() {
  if (starterPrompts) {
    starterPrompts.hidden = true;
  }
}

function showTypingState() {
  const typingNode = createLoadingElement();
  messageList.appendChild(typingNode);
  scrollToBottom();
  return typingNode;
}

function appendAssistantMessage(text) {
  messageList.appendChild(createMessageElement('assistant', text));
  scrollToBottom();
}

function getFriendlyApiErrorMessage(statusCode, payload) {
  const serverMessage = typeof payload?.error === 'string' ? payload.error.trim() : '';

  if (serverMessage) {
    return serverMessage;
  }

  if (statusCode === 400) {
    return 'Please enter a startup-related question before sending.';
  }

  if (statusCode === 413) {
    return 'That message is too long. Please shorten it and try again.';
  }

  if (statusCode === 429) {
    return 'ProofPilot is busy right now. Please wait a moment and try again.';
  }

  if (statusCode === 401 || statusCode === 403) {
    return 'The AI service rejected the request. Please check the server API key and provider settings.';
  }

  if (statusCode === 404) {
    return 'The chat API endpoint was not found. Please make sure the ProofPilot server is running from this project folder.';
  }

  if (statusCode === 500 || statusCode === 502) {
    return 'The chatbot backend hit an error while contacting the AI service. Please check the server terminal logs.';
  }

  if (statusCode === 503) {
    return 'The chatbot service is temporarily unavailable. Please try again shortly.';
  }

  if (statusCode === 504) {
    return 'The request took too long to finish. Please try again in a moment.';
  }

  return `I could not complete that request. The server returned status ${statusCode}.`;
}

async function submitMessage(text) {
  const typingNode = showTypingState();
  setLoadingState(true);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(chatEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: text }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(getFriendlyApiErrorMessage(response.status, payload));
    }

    appendAssistantMessage(payload.assistantResponse || 'I do not have a response available right now.');
  } catch (error) {
    if (error?.name === 'AbortError') {
      appendAssistantMessage('The request took too long to finish. Please try again in a moment.');
    } else if (error?.message) {
      appendAssistantMessage(error.message);
    } else {
      appendAssistantMessage('I am having trouble responding right now. Please try again in a moment.');
    }
  } finally {
    window.clearTimeout(timeoutId);
    typingNode.remove();
    setLoadingState(false);
    scrollToBottom();
  }
}

renderInitialMessages();
autoResizeInput();

chatInput.addEventListener('input', autoResizeInput);
chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

starterPrompts?.addEventListener('click', (event) => {
  const button = event.target.closest('.starter-prompt');
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  chatInput.value = button.dataset.prompt || button.textContent || '';
  autoResizeInput();
  chatForm.requestSubmit();
});

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const text = chatInput.value.trim();
  if (!text) {
    showNotice('Please enter a startup-related question before sending.');
    return;
  }

  messageList.appendChild(createMessageElement('user', text));
  hideStarterPrompts();
  chatInput.value = '';
  autoResizeInput();
  submitMessage(text);
});
