// Get a reference to the VS Code API
const vscode = acquireVsCodeApi();

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const codeInput = document.getElementById('codeInput');
const chatInput = document.getElementById('chatInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const sendChatBtn = document.getElementById('sendChatBtn');
const scanFileBtn = document.getElementById('scanFileBtn');
const scanProjectBtn = document.getElementById('scanProjectBtn');
const analyzeOpenFileBtn = document.getElementById('analyzeOpenFileBtn');
const chatToggleBtn = document.getElementById('chatToggleBtn');
const codeToggleBtn = document.getElementById('codeToggleBtn');
const chatInputWrapper = document.getElementById('chatInputWrapper');
const codeInputWrapper = document.getElementById('codeInputWrapper');
const currentScanLocation = document.getElementById('currentScanLocation');

// Toggle input modes
chatToggleBtn.addEventListener('click', () => {
  chatToggleBtn.classList.add('active');
  codeToggleBtn.classList.remove('active');
  chatInputWrapper.classList.remove('hidden');
  codeInputWrapper.classList.add('hidden');
  chatInput.focus();
});

codeToggleBtn.addEventListener('click', () => {
  codeToggleBtn.classList.add('active');
  chatToggleBtn.classList.remove('active');
  codeInputWrapper.classList.remove('hidden');
  chatInputWrapper.classList.add('hidden');
  codeInput.focus();
});

// Add event listeners
analyzeBtn.addEventListener('click', () => {
  const code = codeInput.value.trim();
  if (code) {
    addUserMessage(code);
    vscode.postMessage({ type: 'analyze', text: code });
  }
});

sendChatBtn.addEventListener('click', () => {
  sendChatMessage();
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

scanFileBtn.addEventListener('click', () => {
  vscode.postMessage({ type: 'scanFile' });
  addSystemMessage('Scanning current file...');
});

scanProjectBtn.addEventListener('click', () => {
  vscode.postMessage({ type: 'scanProject' });
  addSystemMessage('Scanning project files...');
});

analyzeOpenFileBtn.addEventListener('click', () => {
  vscode.postMessage({ type: 'analyzeOpenFile' });
  addSystemMessage('Analyzing open file...');
});

function sendChatMessage() {
  const text = chatInput.value.trim();
  if (text) {
    addUserMessage(text);
    vscode.postMessage({ type: 'userMessage', text: text });
    chatInput.value = '';
  }
}

// Handle messages sent from the extension to the webview
window.addEventListener('message', event => {
  const message = event.data;
  
  switch (message.type) {
    case 'response':
      addSystemMessage(message.message);
      break;
      
    case 'startAnalysis':
      addAssistantMessage('<div class="spinner"></div> Analyzing code...', 'analyzing');
      break;
      
    case 'startThinking':
      addAssistantMessage('<div class="spinner"></div> Thinking...', 'thinking');
      break;
      
    case 'chatResponse':
      // Remove the thinking message
      const thinkingMessage = document.querySelector('.message.thinking');
      if (thinkingMessage) {
        chatMessages.removeChild(thinkingMessage);
      }
      
      // Add the assistant's response with markdown rendering
      addAssistantMessage(renderMarkdown(message.message));
      break;
      
    case 'analysisResult':
      // Remove the analyzing message
      const analyzingMessage = document.querySelector('.message.analyzing');
      if (analyzingMessage) {
        chatMessages.removeChild(analyzingMessage);
      }
      
      // Add the result message
      const result = message.result;
      let content = `<p>${result.summary}</p>`;
      
      if (result.issues && result.issues.length > 0) {
        content += '<div class="security-issues">';
        
        result.issues.forEach(issue => {
          const severityClass = issue.severity.toLowerCase();
          
          content += `
            <div class="security-issue ${severityClass}">
              <div class="security-issue-title">${issue.title}</div>
              <div class="security-issue-description">${issue.message}</div>
              <div class="security-issue-location">Line: ${issue.line + 1}</div>
              <div class="security-issue-suggestion">${issue.suggestion}</div>
              ${renderCodeFix(issue.fix)}
            </div>
          `;
        });
        
        content += '</div>';
      }
      
      addAssistantMessage(content);
      break;
      
    case 'updateScanLocation':
      updateScanLocation(message.location);
      break;
      
    case 'error':
      addSystemMessage(`Error: ${message.message}`);
      break;
      
    case 'fixApplied':
      addSystemMessage(message.message);
      break;
  }
});

// Helper function to add user message to chat
function addUserMessage(text) {
  const message = document.createElement('div');
  message.className = 'message user';
  
  // Check if this is code
  if (text.includes('\n') || text.includes('function') || text.includes('class') || text.includes('{')) {
    message.innerHTML = `
      <div class="message-content">
        <pre><code>${escapeHtml(text)}</code></pre>
      </div>
    `;
  } else {
    message.innerHTML = `
      <div class="message-content">
        <p>${escapeHtml(text)}</p>
      </div>
    `;
  }
  
  chatMessages.appendChild(message);
  scrollToBottom();
}

// Helper function to add assistant message to chat
function addAssistantMessage(html, extraClass = '') {
  const message = document.createElement('div');
  message.className = `message assistant ${extraClass}`;
  message.innerHTML = `<div class="message-content">${html}</div>`;
  
  chatMessages.appendChild(message);
  scrollToBottom();
}

// Helper function to add system message to chat
function addSystemMessage(text) {
  const message = document.createElement('div');
  message.className = 'message system';
  message.innerHTML = `<div class="message-content"><p>${escapeHtml(text)}</p></div>`;
  
  chatMessages.appendChild(message);
  scrollToBottom();
}

// Helper function to render code fix with highlighting
function renderCodeFix(fix) {
  if (!fix) return '';
  
  return `
    <div class="security-issue-fix">
      <div class="highlighted-code">
        <span class="code-removed">${escapeHtml(fix.original)}</span>
        <span class="code-added">${escapeHtml(fix.fixed)}</span>
      </div>
      <button class="apply-fix-btn" onclick="applyFix('${escapeJs(fix.original)}', '${escapeJs(fix.fixed)}')">
        Apply Fix
      </button>
    </div>
  `;
}

// Update scan location in UI
function updateScanLocation(location) {
  if (!location) {
    currentScanLocation.textContent = 'No active scan';
    return;
  }
  
  // Truncate long paths for display
  let displayPath = location;
  if (displayPath.length > 50) {
    const parts = displayPath.split('/');
    if (parts.length > 4) {
      displayPath = '.../' + parts.slice(-3).join('/');
    }
  }
  
  currentScanLocation.textContent = displayPath;
  currentScanLocation.title = location; // Full path on hover
}

// Function to apply code fix
function applyFix(original, fixed) {
  vscode.postMessage({
    type: 'fixCode',
    original,
    fixed
  });
}

// Simple markdown renderer
function renderMarkdown(text) {
  if (!text) {
    return '';
  }
  
  // Code blocks (```code```)
  text = text.replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre><code class="language-$1">$2</code></pre>');
  
  // Inline code (`code`)
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Headers
  text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  
  // Bold and italic
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Lists
  text = text.replace(/^\s*\*\s*(.*)/gm, '<li>$1</li>'); 
  text = text.replace(/^\s*\d+\.\s*(.*)/gm, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>)\n(?!\s*<li>)/g, '$1</ul>\n');
  text = text.replace(/(?<!\s*<\/ul>)\n\s*<li>/g, '\n<ul><li>');
  
  // Diff styling for code snippets
  text = text.replace(/^\-\s*(.*)/gm, '<span class="code-removed">$1</span>');
  text = text.replace(/^\+\s*(.*)/gm, '<span class="code-added">$1</span>');
  
  // Line breaks
  text = text.replace(/\n/g, '<br>');
  
  return text;
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Helper function to escape JavaScript strings
function escapeJs(unsafe) {
  return unsafe
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

// Helper to scroll chat to bottom
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
} 