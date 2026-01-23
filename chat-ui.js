// UI helpers + settings tools (memory, import/share) + safer markdown rendering

(function () {
  // Expose a small UI module to chat.js
  window.DivineUI = {
    // --- Safe Markdown ---
    renderSafeMarkdown(markdownText) {
      try {
        const raw = marked.parse(markdownText || "");
        // sanitize everything that goes into innerHTML
        return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
      } catch (e) {
        // worst case: escape as text
        const div = document.createElement("div");
        div.textContent = markdownText || "";
        return div.innerHTML;
      }
    },

    // --- Download helper ---
    downloadTextFile(filename, content, mime = "text/plain") {
      const blob = new Blob([content], { type: mime });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (filename || "download").replace(/[\\\/:*?"<>|]/g, "_");
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      }, 100);
    },

    // --- Clipboard helper ---
    async copyToClipboard(text) {
      if (!navigator.clipboard) throw new Error("Clipboard not available.");
      await navigator.clipboard.writeText(text);
    },

    // --- Little animation helper ---
    animateIn(el) {
      if (!el) return;
      el.classList.remove("pop-in");
      void el.offsetWidth; // reflow
      el.classList.add("pop-in");
    },

    // --- Memory ---
    MEMORY_KEY: "divineai_memory_v1",

    loadMemory() {
      try {
        return localStorage.getItem(this.MEMORY_KEY) || "";
      } catch {
        return "";
      }
    },

    saveMemory(text) {
      localStorage.setItem(this.MEMORY_KEY, text || "");
    },

    clearMemory() {
      localStorage.setItem(this.MEMORY_KEY, "");
    },

    initMemoryPanel() {
      const memoryInput = document.getElementById("memory-input");
      const saveBtn = document.getElementById("memory-save-btn");
      const clearBtn = document.getElementById("memory-clear-btn");
      if (!memoryInput || !saveBtn || !clearBtn) return;

      memoryInput.value = this.loadMemory();

      saveBtn.onclick = () => {
        this.saveMemory(memoryInput.value.trim());
        window.showFloatingBubble?.("Memory saved.");
      };

      clearBtn.onclick = () => {
        if (!confirm("Clear memory?")) return;
        memoryInput.value = "";
        this.clearMemory();
        window.showFloatingBubble?.("Memory cleared.");
      };
    },

    // --- Import / Share ---
    initImportSharePanel() {
      const importBtn = document.getElementById("import-chat-btn");
      const importFile = document.getElementById("import-chat-file");
      const shareBtn = document.getElementById("share-chat-btn");
      const copyShareBtn = document.getElementById("copy-share-json-btn");

      if (importBtn && importFile) {
        importBtn.onclick = () => importFile.click();

        importFile.onchange = async () => {
          const file = importFile.files?.[0];
          importFile.value = "";
          if (!file) return;

          try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Expect either { chat: {...} } or direct chat object
            const chatObj = data.chat || data;

            if (!chatObj || typeof chatObj !== "object" || !Array.isArray(chatObj.messages)) {
              throw new Error("Invalid chat JSON format.");
            }

            // delegate to chat.js (must exist)
            window.importChatFromObject?.(chatObj);
            window.showFloatingBubble?.("Chat imported.");
          } catch (e) {
            alert("Import failed: " + e.message);
          }
        };
      }

      if (shareBtn) {
        shareBtn.onclick = () => {
          const obj = window.exportCurrentChatAsObject?.();
          if (!obj) return;

          const payload = {
            version: 1,
            exportedAt: Date.now(),
            chat: obj
          };

          const fname = (obj.name || "chat") + ".json";
          this.downloadTextFile(fname, JSON.stringify(payload, null, 2), "application/json");
          window.showFloatingBubble?.("Chat JSON downloaded.");
        };
      }

      if (copyShareBtn) {
        copyShareBtn.onclick = async () => {
          const obj = window.exportCurrentChatAsObject?.();
          if (!obj) return;

          const payload = {
            version: 1,
            exportedAt: Date.now(),
            chat: obj
          };

          try {
            await this.copyToClipboard(JSON.stringify(payload, null, 2));
            window.showFloatingBubble?.("Chat JSON copied.");
          } catch (e) {
            alert("Copy failed: " + e.message);
          }
        };
      }
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    window.DivineUI.initMemoryPanel();
    window.DivineUI.initImportSharePanel();
  });
})();
