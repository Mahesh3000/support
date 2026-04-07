<template>
  <div class="homeview_container">

    <div class="center_container">

      <!-- Left: Narrow transcription sidebar -->
      <div class="sidebar_panel">
        <div class="panel_header">
          <i class="el-icon-microphone"></i>
          <span>Live Transcription</span>
          <span v-if="state === 'ing'" class="live_badge">● LIVE</span>
        </div>
        <div v-if="!currentText" class="empty_state">
          <i class="el-icon-microphone empty_icon"></i>
          <p>Live speech transcription will appear here once the session starts</p>
        </div>
        <div class="asr_content">{{ currentText }}</div>
        <div class="panel_footer">
          <el-button size="small" icon="el-icon-delete" :disabled="!currentText" @click="clearASRContent">
            Clear Text
          </el-button>
        </div>
      </div>

      <!-- Center: Wide GPT Answer panel -->
      <div class="main_panel">

        <div class="panel_header">
          <i class="el-icon-magic-stick"></i>
          <span>AI Insights</span>

          <el-button v-show="state === 'end'" class="ask_inline_btn" type="success" size="small"
            icon="el-icon-video-play" @click="startCopilot" :loading="copilot_starting" :disabled="copilot_starting">
            Start Session
          </el-button>

          <el-button v-show="state === 'ing'" class="ask_inline_btn" size="small" icon="el-icon-video-pause"
            @click="userStopCopilot" :loading="copilot_stopping">
            Stop Session
          </el-button>

          <MyTimer ref="MyTimer" class="header_timer" />
        </div>

        <div class="ai_result_wrapper">
          <LoadingIcon v-show="show_ai_thinking_effect" />
          <div v-if="!ai_result && !show_ai_thinking_effect" class="empty_state centered">
            <i class="el-icon-s-opportunity empty_icon large"></i>
            <p>Start the session to begin live transcription and get AI responses.</p>
            <p class="hint">You can also clear the transcript and ask a new question</p>
          </div>
          <!-- ✅ v-html renders markdown as real HTML -->
          <div class="ai_result_content" v-if="ai_result" v-html="renderedResult"></div>
        </div>

        <form class="panel_footer ask_bar" @submit.prevent="askCurrentText">
          <input v-model="customQuestion" type="text" placeholder="Ask a question about the conversation..."
            class="ask_input_native" />
          <el-button type="primary" size="small" icon="el-icon-s-promotion"
            :disabled="!isGetGPTAnswerAvailable || show_ai_thinking_effect" native-type="submit">
            Send
          </el-button>
        </form>

      </div>

    </div>

  </div>
</template>

<script>
import LoadingIcon from "@/components/LoadingIcon.vue";
import MyTimer from "@/components/MyTimer.vue";
import config_util from "../utils/config_util";

// ── Tiny markdown renderer (no extra dependencies) ───────────────────────────
function renderMarkdown(text) {
  if (!text) return "";

  let html = text
    // Escape raw HTML to prevent XSS
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

    // Code blocks (``` ... ```)
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
      return `<pre><code>${code}</code></pre>`;
    })

    // Inline code (`code`)
    .replace(/`([^`]+)`/g, "<code>$1</code>")

    // Bold (**text** or __text__)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")

    // Italic (*text* or _text_)
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")

    // Headings (###, ##, #)
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")

    // Unordered lists (- item or * item)
    .replace(/^[\*\-] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]+?<\/li>)/g, "<ul>$1</ul>")
    // Fix nested ul wrapping (multiple consecutive li)
    .replace(/<\/ul>\s*<ul>/g, "")

    // Numbered lists (1. item)
    .replace(/^\d+\. (.+)$/gm, "<oli>$1</oli>")
    .replace(/(<oli>[\s\S]+?<\/oli>)/g, "<ol>$1</ol>")
    .replace(/<\/ol>\s*<ol>/g, "")
    .replace(/<oli>/g, "<li>")
    .replace(/<\/oli>/g, "</li>")

    // Horizontal rule
    .replace(/^---$/gm, "<hr>")

    // Paragraphs: double newlines
    .replace(/\n{2,}/g, "</p><p>")

    // Single line breaks inside paragraphs
    .replace(/\n/g, "<br>");

  return `<p>${html}</p>`;
}

export default {
  name: "HomeView",
  components: { LoadingIcon, MyTimer },

  computed: {
    isGetGPTAnswerAvailable() {
      return !!this.currentText || !!this.customQuestion?.trim();
    },

    // ✅ Computed property — re-renders markdown whenever ai_result changes
    renderedResult() {
      return renderMarkdown(this.ai_result);
    },
  },

  data() {
    return {
      currentText: "",
      customQuestion: "",
      state: "end",
      ai_result: null,
      copilot_starting: false,
      copilot_stopping: false,
      show_ai_thinking_effect: false,
      dgSocket: null,
      mediaStream: null,
      mediaRecorder: null,
    };
  },

  mounted() {
    window.addEventListener("keydown", this.handleGlobalEnter);
  },

  beforeDestroy() {
    window.removeEventListener("keydown", this.handleGlobalEnter);
  },

  methods: {
    handleGlobalEnter(e) {
      if (e.key !== "Enter") return;
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTypingInField =
        tag === "textarea" ||
        (tag === "input" && document.activeElement?.type !== "button");
      if (isTypingInField && tag === "textarea") return;
      e.preventDefault();
      this.askCurrentText();
    },

    async askCurrentText() {
      if (this.show_ai_thinking_effect) return;

      const apiKey = config_util.anthropic_key();
      const content = this.customQuestion?.trim() || this.currentText?.trim();

      if (!content) {
        this.ai_result = "Please type a question or start the transcription.";
        return;
      }

      this.ai_result = "";
      this.show_ai_thinking_effect = true;

      const gpt_system_prompt = config_util.gpt_system_prompt();

      // Only send the last 500 chars of transcript to keep requests fast
      const recentText = this.currentText.slice(-500);

      try {
        if (!apiKey) throw new Error("Anthropic API key not set!");

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 400,           // ✅ Reduced for faster responses
            stream: true,              // ✅ Streaming enabled
            system: gpt_system_prompt,
            messages: [
              {
                role: "user",
                content: `TRANSCRIPTION:\n${recentText}\n\nQUESTION:\n${this.customQuestion || "Answer the last question from the transcription."
                  }`,
              },
            ],
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err?.error?.message || "API error");
        }

        // ✅ Stream handling — text appears word-by-word
        this.show_ai_thinking_effect = false;
        this.ai_result = "";

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const lines = decoder.decode(value).split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") break;
            try {
              const evt = JSON.parse(json);
              if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                this.ai_result += evt.delta.text;
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        this.customQuestion = "";
      } catch (e) {
        this.ai_result = "**Error:** " + e.message;
      } finally {
        this.show_ai_thinking_effect = false;
      }
    },

    clearASRContent() {
      this.currentText = "";
    },

    // ─── Deepgram START ────────────────────────────────────────────────────
    async startCopilot() {
      this.copilot_starting = true;

      const deepgramKey = config_util.deepgram_key();
      if (!deepgramKey) {
        this.currentText =
          "Error: Deepgram API key not set. Add VUE_APP_DEEPGRAM_KEY to your .env file.";
        this.copilot_starting = false;
        return;
      }

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const url =
          "wss://api.deepgram.com/v1/listen?language=en-US&punctuate=true&interim_results=false";
        this.dgSocket = new WebSocket(url, ["token", deepgramKey]);

        this.dgSocket.onopen = () => {
          console.log("✅ Deepgram connected");

          this.mediaRecorder = new MediaRecorder(this.mediaStream, {
            mimeType: "audio/webm",
          });

          this.mediaRecorder.ondataavailable = (event) => {
            if (
              event.data.size > 0 &&
              this.dgSocket.readyState === WebSocket.OPEN
            ) {
              this.dgSocket.send(event.data);
            }
          };

          this.mediaRecorder.start(250);
          this.copilot_starting = false;
          this.state = "ing";
          this.$refs.MyTimer.start();
        };

        this.dgSocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const transcript = data?.channel?.alternatives?.[0]?.transcript;
            if (transcript && transcript.trim().length > 0) {
              console.log("📝 transcript:", transcript);
              this.currentText =
                (this.currentText ? this.currentText + "\n" : "") + transcript;
            }
          } catch (e) {
            console.error("parse error:", e);
          }
        };

        this.dgSocket.onerror = (err) => {
          console.error("❌ Deepgram error:", err);
          this.currentText =
            "Deepgram connection error. Check your API key in .env (VUE_APP_DEEPGRAM_KEY)";
          this.copilot_starting = false;
          this.state = "end";
        };

        this.dgSocket.onclose = (event) => {
          console.log("🔌 Deepgram closed:", event.code, event.reason);
        };
      } catch (e) {
        console.error("startCopilot error:", e);
        this.currentText = "Error: " + e.message;
        this.copilot_starting = false;
      }
    },

    // ─── Deepgram STOP ─────────────────────────────────────────────────────
    userStopCopilot() {
      this.copilot_stopping = true;

      if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
        this.mediaRecorder.stop();
      }
      if (this.dgSocket) {
        this.dgSocket.close();
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      }

      this.copilot_stopping = false;
      this.state = "end";
      this.$refs.MyTimer.stop();
    },
  },
};
</script>

<style scoped>
.homeview_container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f6fa;
}

.center_container {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar_panel {
  width: 280px;
  min-width: 220px;
  max-width: 320px;
  background: #ffffff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main_panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  overflow: hidden;
}

.panel_header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid #e4e7ed;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  background: #fafafa;
}

.panel_header i {
  font-size: 16px;
  color: #409eff;
}

.live_badge {
  font-size: 11px;
  color: #f56c6c;
  font-weight: 700;
  margin-left: auto;
  animation: pulse 1.2s infinite;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}

.ask_inline_btn {
  margin-left: auto;
}

.asr_content {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.7;
  color: #606266;
  white-space: pre-wrap;
}

.ask_input_native {
  flex: 1;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}

.ask_input_native:focus {
  border-color: #409eff;
}

.ai_result_wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  position: relative;
}

.header_timer {
  margin-left: 8px;
}

/* ✅ Markdown-rendered content styles */
.ai_result_content {
  font-size: 14px;
  line-height: 1.8;
  color: #303133;
}

.ai_result_content :deep(p) {
  margin: 0 0 10px 0;
}

.ai_result_content :deep(strong) {
  font-weight: 700;
  color: #1a1a2e;
}

.ai_result_content :deep(em) {
  font-style: italic;
}

.ai_result_content :deep(h1),
.ai_result_content :deep(h2),
.ai_result_content :deep(h3) {
  font-weight: 700;
  margin: 16px 0 8px;
  color: #1d1d1d;
}

.ai_result_content :deep(h1) {
  font-size: 20px;
}

.ai_result_content :deep(h2) {
  font-size: 17px;
}

.ai_result_content :deep(h3) {
  font-size: 15px;
}

.ai_result_content :deep(ul),
.ai_result_content :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
}

.ai_result_content :deep(li) {
  margin-bottom: 4px;
}

.ai_result_content :deep(code) {
  background: #f0f2f5;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  font-family: monospace;
  color: #d63384;
}

.ai_result_content :deep(pre) {
  background: #1e1e2e;
  color: #cdd6f4;
  border-radius: 8px;
  padding: 14px 16px;
  font-size: 13px;
  overflow-x: auto;
  margin: 12px 0;
}

.ai_result_content :deep(pre code) {
  background: none;
  color: inherit;
  padding: 0;
  font-size: inherit;
}

.ai_result_content :deep(hr) {
  border: none;
  border-top: 1px solid #e4e7ed;
  margin: 16px 0;
}

.empty_state {
  padding: 16px;
  color: #909399;
  font-size: 13px;
  line-height: 1.6;
}

.empty_state.centered {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  gap: 12px;
}

.empty_icon {
  font-size: 24px;
  color: #c0c4cc;
}

.empty_icon.large {
  font-size: 48px;
}

.empty_state p {
  max-width: 360px;
  margin: 0;
}

.hint {
  font-size: 12px;
  color: #c0c4cc;
}

.panel_footer {
  padding: 10px 12px;
  border-top: 1px solid #e4e7ed;
  display: flex;
  gap: 8px;
}

.panel_footer .el-button {
  width: 100%;
}

.ask_bar {
  align-items: center;
}
</style>