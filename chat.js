// Divine AI - frontend-only implementation
// Features: multi-chat sidebar, persistent chat titles, per-model limits, auto model switching, floating notification bubbles, response copy button, full system prompts, and export chat as Markdown with timestamps.

// --- API ---
const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const part1 = "gsk_tklwAb0p0ulXOlfH3";
const part2 = "mmZWGdyb3FYE2aCHD";
const part3 = "SFeFdTudQ9VdzapQOz";
const API_KEY = part1 + part2 + part3;

// --- Model selection ---
const LOCAL_MODEL_KEY = "divineai_model";
const MODELS = {
  flex: {
    id: "openai/gpt-oss-20b",
    name: "Flex 1.0",
    limit: 25,
    systemPrompt: "You are Divine AI, an efficient assistant. Always prioritize helpful, direct answers to any user question. Never mention any other AI. [FILL OUT YOUR PROMPT HERE!]"
  },
  comfort: {
    id: "openai/gpt-oss-20b",
    name: "Comfort 1.0",
    limit: 25,
    systemPrompt: "You are Divine AI, focused on making users feel comfortable and happy in the chat. [FILL OUT YOUR PROMPT HERE!]"
  },
  agent: {
    id: "openai/gpt-oss-20b",
    name: "Agent 1.0",
    limit: 25,
    systemPrompt: "You are Divine AI Agent, laser-focused on coding, programming, and software help. [FILL OUT YOUR PROMPT HERE!]"
  }
};

function getSelectedModelKey() {
  return localStorage.getItem(LOCAL_MODEL_KEY) || "flex";
}
function setSelectedModelKey(val) {
  localStorage.setItem(LOCAL_MODEL_KEY, val);
}

// --- Chat Management ---
const LOCAL_CHATS_KEY = "divineai_chats_v1";
let allChats = [];
let currentChatId = null;

function genId() {
  return "c" + Math.random().toString(36).slice(2, 10) + Date.now();
}

// Load chats from localStorage
function loadChats() {
  allChats = [];
  try {
    allChats = JSON.parse(localStorage.getItem(LOCAL_CHATS_KEY)) || [];
  } catch { allChats = []; }
  // If none exist, make a new chat
  if (!allChats.length) {
    currentChatId = null;
    createNewChat();
  }
  // If currentChatId is gone (chat deleted), pick first chat
  if (!allChats.some(chat => chat.id === currentChatId)) {
    currentChatId = allChats[0]?.id;
  }
}

// Save all chats to localStorage
function saveChats() {
  localStorage.setItem(LOCAL_CHATS_KEY, JSON.stringify(allChats));
}

// Chat creation: Inserts system prompt as the first message.
function createNewChat() {
  const id = genId();
  const modelKey = getSelectedModelKey();
  const model = MODELS[modelKey] || MODELS.flex;
  const chat = {
    id,
    modelKey,
    modelId: model.id,
    name: "New Chat",
    messages: [
      {
        role: "system",
        content: model.systemPrompt
      }
    ]
  };
  allChats.unshift(chat);
  currentChatId = id;
  saveChats();
  renderChatList();
  loadCurrentChat();
}

// Get current chat object
function currentChat() {
  return allChats.find(chat => chat.id === currentChatId);
}

// --- Dark mode logic (persisted / defaults to dark) ---
const body = document.body;
const DARK_KEY = "divineai_dark";
const dmToggle = document.getElementById('darkmode-toggle');

function setDarkMode(on) {
  if (on) {
    body.classList.add("dark");
    localStorage.setItem(DARK_KEY, "1");
    if(dmToggle) dmToggle.checked = true;
  } else {
    body.classList.remove("dark");
    localStorage.setItem(DARK_KEY, "");
    if(dmToggle) dmToggle.checked = false;
  }
}
if(dmToggle) {
  dmToggle.onchange = e => setDarkMode(e.target.checked);
}
// Default: dark mode ON unless user set preference
if (localStorage.getItem(DARK_KEY) === "1") setDarkMode(true);
else if (localStorage.getItem(DARK_KEY) === null) setDarkMode(true);
else setDarkMode(false);

// --- Sidebar logic ---
const sidebar = document.getElementById('chats-sidebar');
const chatListDiv = document.getElementById('chat-list');
document.getElementById('chats-btn').onclick = () => sidebar.classList.add('show');
document.getElementById('close-chats-sidebar').onclick = () => sidebar.classList.remove('show');
const newChatBtn = document.getElementById('new-chat-btn');
function renderChatList() {
  chatListDiv.innerHTML = '';
  chatListDiv.appendChild(newChatBtn);
  for (const chat of allChats) {
    const div = document.createElement('div');
    div.className = "chat-item" + (chat.id === currentChatId ? " selected" : "");
    let titleSpan = document.createElement('span');
    titleSpan.className = "chat-title";
    titleSpan.title = chat.name;
    titleSpan.textContent = chat.name;
    div.appendChild(titleSpan);

    const editBtn = document.createElement('button');
    editBtn.className = "chat-edit-btn";
    editBtn.innerHTML = "&#9998;";
    editBtn.title = "Edit chat name";
    editBtn.onclick = (e) => {
      e.stopPropagation();
      startEditChatTitle(chat, titleSpan, div);
    };
    div.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = "chat-delete-btn";
    deleteBtn.title = "Delete chat";
    deleteBtn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" style="vertical-align:middle;"><path d="M6 7v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7"/><path d="M19 6H5"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm("Delete this chat?")) {
        allChats = allChats.filter(c => c.id !== chat.id);
        if (currentChatId === chat.id) {
          currentChatId = allChats.length ? allChats[0].id : null;
        }
        saveChats();
        renderChatList();
        loadCurrentChat();
      }
    };
    div.appendChild(deleteBtn);

    div.onclick = () => {
      if (currentChatId !== chat.id) {
        currentChatId = chat.id;
        saveChats();
        renderChatList();
        loadCurrentChat();
        sidebar.classList.remove('show');
      }
    };
    chatListDiv.appendChild(div);
  }
}
newChatBtn.onclick = () => {
  createNewChat();
  sidebar.classList.remove('show');
};

function startEditChatTitle(chat, titleSpan, containerDiv) {
  const input = document.createElement('input');
  input.type = "text";
  input.className = "chat-name-input";
  input.value = chat.name;
  input.maxLength = 80;
  input.onkeydown = e => {
    if (e.key === "Enter") {
      finishEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };
  input.onblur = finishEdit;
  containerDiv.replaceChild(input, titleSpan);
  input.focus();
  input.select();

  function finishEdit() {
    chat.name = input.value.trim() || "Untitled";
    saveChats();
    renderChatList();
  }
  function cancelEdit() {
    renderChatList();
  }
}

// --- Chat Area Rendering ---
const chatArea = document.getElementById('chat-area');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

function loadCurrentChat() {
  chatArea.innerHTML = '';
  let chat = currentChat();
  if (!chat) return;
  for (const msg of chat.messages.filter(m => m.role !== 'system')) {
    appendMessage(msg.role === "assistant" ? "ai" : "user", msg.content);
  }
  updateMessageLimitUI();
}

// --- Floating Bubble
function showFloatingBubble(text) {
  let bubble = document.createElement('div');
  bubble.className = "floating-bubble";
  bubble.textContent = text;
  Object.assign(bubble.style, {
    position: "fixed",
    right: "30px",
    bottom: "110px",
    background: "#333",
    color: "#fff",
    padding: "12px 22px",
    borderRadius: "16px",
    fontSize: "1.03rem",
    boxShadow: "0 2px 12px #0003",
    zIndex: 5000,
    opacity: 0,
    transition: "opacity 0.3s"
  });
  document.body.appendChild(bubble);
  setTimeout(() => bubble.style.opacity = 1, 20);
  setTimeout(() => {
    bubble.style.opacity = 0;
    setTimeout(() => bubble.remove(), 300);
  }, 5000);
}

// --- COPY BUTTON LOGIC ---
function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  if (role === 'ai') {
    div.innerHTML = `<b>AI:</b> <span class="msg-content">${marked.parse(content)}</span>`;
    // Add copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = "copy-btn";
    copyBtn.title = "Copy response";
    copyBtn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2" stroke="currentColor" fill="none"/><rect x="3" y="3" width="13" height="13" rx="2" stroke-width="2" stroke="currentColor" fill="none"/></svg>';
    copyBtn.onclick = (e) => {
      const toCopy = div.querySelector('.msg-content').innerText;
      navigator.clipboard.writeText(toCopy);
      copyBtn.innerHTML = "&#10003;";
      copyBtn.title = "Copied!";
      setTimeout(() => {
        copyBtn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2" stroke="currentColor" fill="none"/><rect x="3" y="3" width="13" height="13" rx="2" stroke-width="2" stroke="currentColor" fill="none"/></svg>';
        copyBtn.title = "Copy response";
      }, 1200);
      e.stopPropagation();
    };
    div.appendChild(copyBtn);
  } else {
    div.innerHTML = `<b>You:</b> ${content}`;
  }
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// --- Message Limit Logic ---
function getTodayKey() {
  const now = new Date();
  return `divine_message_count_${now.getUTCFullYear()}_${now.getUTCMonth()}_${now.getUTCDate()}`;
}
function getMessageCount() {
  return parseInt(localStorage.getItem(getTodayKey()) || "0", 10);
}
function incrementMessageCount() {
  const key = getTodayKey();
  const count = getMessageCount() + 1;
  localStorage.setItem(key, count);
  return count;
}
function updateMessageLimitUI() {
  const count = getMessageCount();
  let info = document.getElementById('limit-info');
  const chat = currentChat();
  let modelKey = chat?.modelKey || "flex";
  let limit = MODELS[modelKey]?.limit || 25;
  if (!info) {
    info = document.createElement('div');
    info.id = 'limit-info';
    info.style.marginBottom = '8px';
    info.style.color = '#555';
    chatArea.parentElement.insertBefore(info, chatArea);
  }
  info.textContent = `Daily messages: ${count} / ${limit}`;
  if (count >= limit) {
    userInput.disabled = true;
    sendBtn.disabled = true;
    info.style.color = "red";
    info.textContent += " (limit reached)";
  } else {
    userInput.disabled = false;
    sendBtn.disabled = false;
    info.style.color = "#555";
  }
}

// --- Model Limit Helper
function getCurrentModelLimit() {
  let chat = currentChat();
  let modelKey = chat?.modelKey || "flex";
  return MODELS[modelKey]?.limit || 25;
}

// --- Sending Message ---
async function sendMessage() {
  if (!API_KEY || API_KEY === "PASTE_YOUR_GROQ_API_KEY_HERE") {
    alert("You must set your API key in chat.js first!");
    return;
  }
  const msgCount = getMessageCount();
  let chat = currentChat();
  let modelKey = chat.modelKey || "flex";
  let model = MODELS[modelKey];
  let limit = model.limit;

  if (msgCount >= limit) {
    // If hitting Comfort/Agent limit, auto-switch to Flex 1 if not already
    if (modelKey === "comfort" || modelKey === "agent") {
      chat.modelKey = "flex";
      chat.modelId = MODELS.flex.id;
      showFloatingBubble("Responses will use another model until 12:00 AM UTC.");
      updateMessageLimitUI();
      saveChats();
      renderChatList();
      loadCurrentChat();
      modelKey = "flex";
      model = MODELS[modelKey];
      limit = model.limit;
      // allow message to go through using Flex 1
    } else {
      updateMessageLimitUI();
      alert("Daily message limit reached. Try again tomorrow!");
      return;
    }
  }
  const msg = userInput.value.trim();
  if (!msg) return;

  // Save timestamp for export
  chat.messages.push({ role: "user", content: msg, timestamp: Date.now() });
  appendMessage('user', msg);
  userInput.value = '';
  sendBtn.disabled = true;
  appendMessage('ai', '<i>Thinking...</i>');

  // Auto-name if first user message
  if (chat.name === "New Chat" && chat.messages.filter(m => m.role === "user").length === 1) {
    chat.name = msg.length > 40 ? msg.slice(0, 37) + "..." : msg;
    saveChats();
    renderChatList();
  }

  const modelId = chat.modelId || MODELS[chat.modelKey || "flex"].id;

  // Strip local-only fields before sending to API
  const sanitizedMessages = (chat.messages || []).map(m => ({ role: m.role, content: m.content }));

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelId,
        messages: sanitizedMessages
      })
    });
    const data = await response.json();
    const aiMsg = data.choices?.[0]?.message?.content?.trim() || "No response.";
    chatArea.removeChild(chatArea.lastChild);
    chat.messages.push({ role: "assistant", content: aiMsg, timestamp: Date.now() });
    appendMessage('ai', aiMsg);
    incrementMessageCount();
    saveChats();
    updateMessageLimitUI();

    // After sending, if we just used last Comfort/Agent message, show bubble and auto-switch
    let newMsgCount = getMessageCount();
    if (
      (modelKey === "comfort" && newMsgCount === MODELS.comfort.limit) ||
      (modelKey === "agent" && newMsgCount === MODELS.agent.limit)
    ) {
      chat.modelKey = "flex";
      chat.modelId = MODELS.flex.id;
      showFloatingBubble("Responses will use another model until 12:00 AM UTC.");
      saveChats();
      renderChatList();
      loadCurrentChat();
    }
  } catch (err) {
    chatArea.removeChild(chatArea.lastChild);
    appendMessage('ai', "Error: " + err.message);
  } finally {
    sendBtn.disabled = false;
    userInput.focus();
  }
}

// --- User interaction ---
sendBtn.onclick = sendMessage;
userInput.onkeydown = e => {
  if (e.key === "Enter") sendMessage();
};

document.getElementById('settings-btn').onclick = () =>
  document.getElementById('settings-modal').classList.add('show');
document.getElementById('close-settings-btn').onclick = () =>
  document.getElementById('settings-modal').classList.remove('show');

const modelSelectEl = document.getElementById("model-select");
if (modelSelectEl) {
  modelSelectEl.value = getSelectedModelKey();
  modelSelectEl.onchange = function() {
    setSelectedModelKey(modelSelectEl.value);
  };
}
loadChats();
renderChatList();
loadCurrentChat();

// --- Export Chat as Markdown ---
const exportBtn = document.getElementById('export-chat-btn');
if (exportBtn) {
  exportBtn.onclick = function() {
    let chat = currentChat();
    if (!chat) return alert("No chat selected!");
    let modelName = MODELS[chat.modelKey]?.name || "Flex 1.0";
    let md = `# Divine Chat Export\n\n**Model:** ${modelName}\n\n`;
    for (const m of chat.messages) {
      if (m.role === "system") continue;
      let ts = m.timestamp ? new Date(m.timestamp).toLocaleString() : '';
      let who = m.role === "user" ? "**You:**" : "**AI:**";
      md += `\n---\n`;
      if (ts) md += `*${ts}*\n`;
      md += `${who}\n\n${m.content.trim()}\n`;
    }
    md += `\n---\n*Exported on ${new Date().toLocaleString()}*\n`;
    let fname = (chat.name || "chat") + ".md";
    let blob = new Blob([md], {type: "text/markdown"});
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname.replace(/[\\\/:*?"<>|]/g, "_");
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); }, 100);
  };
}
