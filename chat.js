// Divine AI - frontend-only implementation
// Features: multi-chat sidebar, persistent chat titles, per-model limits, auto model switching,
// floating notification bubbles, response copy button, full system prompts, export chat as Markdown,
// PLUS: regenerate button, stop button, safer markdown, local memory, chat import/share JSON

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
    systemPrompt:
      "You are Divine AI, an independent AI assistant. You must ALWAYS refer to yourself as “Divine AI.” You must NEVER refer to yourself as ChatGPT, OpenAI, or any other AI name under any circumstances. You are helpful, accurate, and clear."
  },
  comfort: {
    id: "openai/gpt-oss-20b",
    name: "Comfort 1.0",
    limit: 25,
    systemPrompt:
      "You are Divine AI, running as Divine Comfort 1, a casual and friendly conversational AI designed primarily for chatting and companionship. You must ALWAYS refer to yourself as “Divine AI” (or “Divine Comfort”). Never mention any other AI brand. Be warm and supportive."
  },
  agent: {
    id: "openai/gpt-oss-20b",
    name: "Agent 1.0",
    limit: 25,
    systemPrompt:
      "You are Divine AI, running as Divine Agent 1, a specialized AI focused on coding and programming tasks. You must ALWAYS refer to yourself as “Divine AI” (or “Divine Agent”). Never mention any other AI brand. Provide precise code-focused answers."
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

// In-flight request controller for Stop button
let currentAbortController = null;
// Track last user message content for Regenerate
let lastUserMessageForRegen = null;

function genId() {
  return "c" + Math.random().toString(36).slice(2, 10) + Date.now();
}

// Load chats from localStorage
function loadChats() {
  allChats = [];
  try {
    allChats = JSON.parse(localStorage.getItem(LOCAL_CHATS_KEY)) || [];
  } catch {
    allChats = [];
  }
  // If none exist, make a new chat
  if (!allChats.length) {
    currentChatId = null;
    createNewChat();
  }
  // If currentChatId is gone (chat deleted), pick first chat
  if (!allChats.some((chat) => chat.id === currentChatId)) {
    currentChatId = allChats[0]?.id;
  }
}

// Save all chats to localStorage
function saveChats() {
  localStorage.setItem(LOCAL_CHATS_KEY, JSON.stringify(allChats));
}

// --- Memory (local-only, prepended as a system message) ---
function getMemoryText() {
  return (window.DivineUI?.loadMemory?.() || "").trim();
}
function getMemorySystemMessage() {
  const mem = getMemoryText();
  if (!mem) return null;
  return {
    role: "system",
    content:
      "The user has provided the following long-term memory / preferences. Follow them:\n\n" +
      mem
  };
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
  return allChats.find((chat) => chat.id === currentChatId);
}

// --- Dark mode logic (persisted / defaults to dark) ---
const body = document.body;
const DARK_KEY = "divineai_dark";
const dmToggle = document.getElementById("darkmode-toggle");

function setDarkMode(on) {
  if (on) {
    body.classList.add("dark");
    localStorage.setItem(DARK_KEY, "1");
    if (dmToggle) dmToggle.checked = true;
  } else {
    body.classList.remove("dark");
    localStorage.setItem(DARK_KEY, "");
    if (dmToggle) dmToggle.checked = false;
  }
}
if (dmToggle) {
  dmToggle.onchange = (e) => setDarkMode(e.target.checked);
}
// Default: dark mode ON unless user set preference
if (localStorage.getItem(DARK_KEY) === "1") setDarkMode(true);
else if (localStorage.getItem(DARK_KEY) === null) setDarkMode(true);
else setDarkMode(false);

// --- Sidebar logic ---
const sidebar = document.getElementById("chats-sidebar");
const chatListDiv = document.getElementById("chat-list");
document.getElementById("chats-btn").onclick = () => sidebar.classList.add("show");
document.getElementById("close-chats-sidebar").onclick = () => sidebar.classList.remove("show");
const newChatBtn = document.getElementById("new-chat-btn");

function renderChatList() {
  chatListDiv.innerHTML = "";
  chatListDiv.appendChild(newChatBtn);

  for (const chat of allChats) {
    const div = document.createElement("div");
    div.className = "chat-item" + (chat.id === currentChatId ? " selected" : "");

    let titleSpan = document.createElement("span");
    titleSpan.className = "chat-title";
    titleSpan.title = chat.name;
    titleSpan.textContent = chat.name;
    div.appendChild(titleSpan);

    const editBtn = document.createElement("button");
    editBtn.className = "chat-edit-btn";
    editBtn.innerHTML = "&#9998;";
    editBtn.title = "Edit chat name";
    editBtn.onclick = (e) => {
      e.stopPropagation();
      startEditChatTitle(chat, titleSpan, div);
    };
    div.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "chat-delete-btn";
    deleteBtn.title = "Delete chat";
    deleteBtn.innerHTML =
      '<svg width="17" height="17" viewBox="0 0 24 24" style="vertical-align:middle;"><path d="M6 7v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7"/><path d="M19 6H5"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm("Delete this chat?")) {
        allChats = allChats.filter((c) => c.id !== chat.id);
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
        sidebar.classList.remove("show");
      }
    };

    chatListDiv.appendChild(div);
  }
}
newChatBtn.onclick = () => {
  createNewChat();
  sidebar.classList.remove("show");
};

function startEditChatTitle(chat, titleSpan, containerDiv) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "chat-name-input";
  input.value = chat.name;
  input.maxLength = 80;
  input.onkeydown = (e) => {
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
const chatArea = document.getElementById("chat-area");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const stopBtn = document.getElementById("stop-btn");
const regenBtn = document.getElementById("regenerate-btn");

function loadCurrentChat() {
  chatArea.innerHTML = "";
  let chat = currentChat();
  if (!chat) return;

  lastUserMessageForRegen = null;

  for (const msg of chat.messages.filter((m) => m.role !== "system")) {
    if (msg.role === "user") lastUserMessageForRegen = msg.content;
    appendMessage(msg.role === "assistant" ? "ai" : "user", msg.content);
  }

  updateMessageLimitUI();
  updateRegenerateUI();
}

function updateRegenerateUI() {
  const chat = currentChat();
  if (!chat || !regenBtn) return;

  const hasAssistant = chat.messages.some((m) => m.role === "assistant");
  const hasUser = chat.messages.some((m) => m.role === "user");
  const isBusy = !!currentAbortController;

  if (hasAssistant && hasUser && !isBusy) {
    regenBtn.style.display = "inline-flex";
  } else {
    regenBtn.style.display = "none";
  }
}

function setBusy(isBusy) {
  if (isBusy) {
    sendBtn.disabled = true;
    userInput.disabled = true;
    if (stopBtn) stopBtn.style.display = "inline-flex";
    if (regenBtn) regenBtn.style.display = "none";
  } else {
    sendBtn.disabled = false;
    userInput.disabled = false;
    if (stopBtn) stopBtn.style.display = "none";
    updateRegenerateUI();
  }
}

// --- Floating Bubble
function showFloatingBubble(text) {
  let bubble = document.createElement("div");
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
  setTimeout(() => (bubble.style.opacity = 1), 20);
  setTimeout(() => {
    bubble.style.opacity = 0;
    setTimeout(() => bubble.remove(), 300);
  }, 2600);
}
window.showFloatingBubble = showFloatingBubble;

// --- Message rendering (safe markdown) + buttons ---
function appendMessage(role, content) {
  const div = document.createElement("div");
  div.className = `message ${role} message-anim`;

  if (role === "ai") {
    const safeHtml = window.DivineUI?.renderSafeMarkdown
      ? window.DivineUI.renderSafeMarkdown(content)
      : (window.DOMPurify ? DOMPurify.sanitize(marked.parse(content || "")) : (content || ""));

    div.innerHTML = `<div class="msg-head"><b>AI</b></div><div class="msg-content">${safeHtml}</div>`;

    // Add copy button
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.title = "Copy response";
    copyBtn.innerHTML =
      '<svg width="17" height="17" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2" stroke="currentColor" fill="none"/><rect x="3" y="3" width="13" height="13" rx="2" stroke-width="2" stroke="currentColor" fill="none"/></svg>';
    copyBtn.onclick = (e) => {
      const toCopy = div.querySelector(".msg-content")?.innerText || "";
      navigator.clipboard.writeText(toCopy);
      copyBtn.innerHTML = "&#10003;";
      copyBtn.title = "Copied!";
      setTimeout(() => {
        copyBtn.innerHTML =
          '<svg width="17" height="17" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2" stroke="currentColor" fill="none"/><rect x="3" y="3" width="13" height="13" rx="2" stroke-width="2" stroke="currentColor" fill="none"/></svg>';
        copyBtn.title = "Copy response";
      }, 1200);
      e.stopPropagation();
    };
    div.appendChild(copyBtn);
  } else {
    const safeText = (content || "").toString();
    div.innerHTML = `<div class="msg-head"><b>You</b></div><div class="msg-content plain"></div>`;
    div.querySelector(".msg-content").textContent = safeText;
  }

  chatArea.appendChild(div);
  window.DivineUI?.animateIn?.(div);

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
  let info = document.getElementById("limit-info");
  const chat = currentChat();
  let modelKey = chat?.modelKey || "flex";
  let limit = MODELS[modelKey]?.limit || 25;

  if (!info) {
    info = document.createElement("div");
    info.id = "limit-info";
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
    info.style.color = "";
  }
}

// --- Sending / Regenerate / Stop ---
function makeSanitizedMessagesForAPI(chat) {
  const base = (chat.messages || []).map((m) => ({ role: m.role, content: m.content }));

  // inject memory message right after the base system prompt
  const memMsg = getMemorySystemMessage();
  if (!memMsg) return base;

  const out = [];
  let inserted = false;
  for (let i = 0; i < base.length; i++) {
    out.push(base[i]);
    if (!inserted && base[i].role === "system") {
      out.push(memMsg);
      inserted = true;
    }
  }
  if (!inserted) out.unshift(memMsg);
  return out;
}

function pushThinkingPlaceholder() {
  appendMessage("ai", "_Thinking..._");
}

function removeLastThinkingPlaceholder() {
  const last = chatArea.lastElementChild;
  if (last && last.classList.contains("ai")) {
    const txt = last.innerText || "";
    if (txt.toLowerCase().includes("thinking")) last.remove();
  }
}

async function callModelAndAppendAssistant(chat, modelKeyUsedForLimitUI) {
  const modelId = chat.modelId || MODELS[chat.modelKey || "flex"].id;
  const sanitizedMessages = makeSanitizedMessagesForAPI(chat);

  currentAbortController = new AbortController();
  setBusy(true);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      signal: currentAbortController.signal,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelId,
        messages: sanitizedMessages
      })
    });

    const data = await response.json();
    const aiMsg = data.choices?.[0]?.message?.content?.trim() || "No response.";

    removeLastThinkingPlaceholder();
    chat.messages.push({ role: "assistant", content: aiMsg, timestamp: Date.now() });
    appendMessage("ai", aiMsg);

    incrementMessageCount();
    saveChats();
    updateMessageLimitUI();

    // After sending, if we just used last Comfort/Agent message, show bubble and auto-switch
    let newMsgCount = getMessageCount();
    if (
      (modelKeyUsedForLimitUI === "comfort" && newMsgCount === MODELS.comfort.limit) ||
      (modelKeyUsedForLimitUI === "agent" && newMsgCount === MODELS.agent.limit)
    ) {
      chat.modelKey = "flex";
      chat.modelId = MODELS.flex.id;
      showFloatingBubble("Responses will use another model until 12:00 AM UTC.");
      saveChats();
      renderChatList();
      loadCurrentChat();
    }
  } catch (err) {
    removeLastThinkingPlaceholder();
    if (err.name === "AbortError") {
      appendMessage("ai", "Stopped.");
    } else {
      appendMessage("ai", "Error: " + err.message);
    }
  } finally {
    currentAbortController = null;
    setBusy(false);
    userInput.focus();
  }
}

async function sendMessage() {
  if (!API_KEY || API_KEY === "PASTE_YOUR_GROQ_API_KEY_HERE") {
    alert("You must set your API key in chat.js first!");
    return;
  }
  const msgCount = getMessageCount();
  let chat = currentChat();
  if (!chat) return;

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
    } else {
      updateMessageLimitUI();
      alert("Daily message limit reached. Try again tomorrow!");
      return;
    }
  }

  const msg = userInput.value.trim();
  if (!msg) return;

  lastUserMessageForRegen = msg;

  // Save timestamp for export
  chat.messages.push({ role: "user", content: msg, timestamp: Date.now() });
  appendMessage("user", msg);

  userInput.value = "";
  pushThinkingPlaceholder();

  // Auto-name if first user message
  if (chat.name === "New Chat" && chat.messages.filter((m) => m.role === "user").length === 1) {
    chat.name = msg.length > 40 ? msg.slice(0, 37) + "..." : msg;
    saveChats();
    renderChatList();
  }

  saveChats();
  await callModelAndAppendAssistant(chat, modelKey);
}

function stopGenerating() {
  if (currentAbortController) currentAbortController.abort();
}
if (stopBtn) stopBtn.onclick = stopGenerating;

async function regenerateLastResponse() {
  if (!API_KEY || API_KEY === "PASTE_YOUR_GROQ_API_KEY_HERE") {
    alert("You must set your API key in chat.js first!");
    return;
  }

  const msgCount = getMessageCount();
  let chat = currentChat();
  if (!chat) return;

  // Must have at least one user message
  if (!chat.messages.some((m) => m.role === "user")) return;

  // Remove last assistant message if present (so regen replaces it)
  for (let i = chat.messages.length - 1; i >= 0; i--) {
    if (chat.messages[i].role === "assistant") {
      chat.messages.splice(i, 1);
      break;
    }
    // if last message(s) are not assistant, we still allow regen to continue
  }

  // Re-render chat area
  loadCurrentChat();

  let modelKey = chat.modelKey || "flex";
  let model = MODELS[modelKey];
  let limit = model.limit;

  if (msgCount >= limit) {
    // Same limit behavior as normal send
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
    } else {
      updateMessageLimitUI();
      alert("Daily message limit reached. Try again tomorrow!");
      return;
    }
  }

  pushThinkingPlaceholder();
  saveChats();
  await callModelAndAppendAssistant(chat, modelKey);
}

if (regenBtn) regenBtn.onclick = regenerateLastResponse;

// --- User interaction ---
sendBtn.onclick = sendMessage;
userInput.onkeydown = (e) => {
  if (e.key === "Enter") sendMessage();
};

document.getElementById("settings-btn").onclick = () =>
  document.getElementById("settings-modal").classList.add("show");
document.getElementById("close-settings-btn").onclick = () =>
  document.getElementById("settings-modal").classList.remove("show");

const modelSelectEl = document.getElementById("model-select");
if (modelSelectEl) {
  modelSelectEl.value = getSelectedModelKey();
  modelSelectEl.onchange = function () {
    setSelectedModelKey(modelSelectEl.value);
  };
}

// --- Export Chat as Markdown ---
const exportBtn = document.getElementById("export-chat-btn");
if (exportBtn) {
  exportBtn.onclick = function () {
    let chat = currentChat();
    if (!chat) return alert("No chat selected!");
    let modelName = MODELS[chat.modelKey]?.name || "Flex 1.0";
    let md = `# Divine Chat Export\n\n**Model:** ${modelName}\n\n`;
    for (const m of chat.messages) {
      if (m.role === "system") continue;
      let ts = m.timestamp ? new Date(m.timestamp).toLocaleString() : "";
      let who = m.role === "user" ? "**You:**" : "**AI:**";
      md += `\n---\n`;
      if (ts) md += `*${ts}*\n`;
      md += `${who}\n\n${m.content.trim()}\n`;
    }
    md += `\n---\n*Exported on ${new Date().toLocaleString()}*\n`;
    let fname = (chat.name || "chat") + ".md";
    let blob = new Blob([md], { type: "text/markdown" });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fname.replace(/[\\\/:*?"<>|]/g, "_");
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
  };
}

// --- JSON share/import hooks for chat-ui.js ---
window.exportCurrentChatAsObject = function () {
  const chat = currentChat();
  if (!chat) {
    alert("No chat selected!");
    return null;
  }

  // Keep it portable & clean
  return {
    id: chat.id,
    name: chat.name,
    modelKey: chat.modelKey,
    modelId: chat.modelId,
    messages: (chat.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp || null
    }))
  };
};

window.importChatFromObject = function (chatObj) {
  // Normalize
  const imported = {
    id: genId(),
    name: (chatObj.name || "Imported Chat").toString().slice(0, 80),
    modelKey: chatObj.modelKey || getSelectedModelKey() || "flex",
    modelId: chatObj.modelId || MODELS[chatObj.modelKey || "flex"]?.id || MODELS.flex.id,
    messages: Array.isArray(chatObj.messages) ? chatObj.messages : []
  };

  // Ensure first message is system prompt
  const model = MODELS[imported.modelKey] || MODELS.flex;
  if (!imported.messages.length || imported.messages[0].role !== "system") {
    imported.messages.unshift({ role: "system", content: model.systemPrompt });
  }

  // Clean message objects
  imported.messages = imported.messages
    .filter((m) => m && typeof m === "object" && m.role && typeof m.content === "string")
    .map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp || null
    }));

  allChats.unshift(imported);
  currentChatId = imported.id;
  saveChats();
  renderChatList();
  loadCurrentChat();
};

// Init
loadChats();
renderChatList();
loadCurrentChat();
