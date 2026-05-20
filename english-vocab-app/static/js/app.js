// ══════════════════════════════════════════════════════════════════════════════
// Tab navigation
// ══════════════════════════════════════════════════════════════════════════════
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "vocab") loadVocab();
    if (btn.dataset.tab === "test") loadTests();
    if (btn.dataset.tab === "settings") loadSettings();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════
async function api(path, method = "GET", body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  return res.json();
}

function el(tag, cls, html = "") {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

function diffBadge(level) {
  const labels = { 0: "", 1: "△", 2: "▲", 3: "✕" };
  const d = el("span", `diff-badge diff-${level}`);
  d.title = level === 0 ? "苦手なし" : `苦手レベル${level}`;
  return d;
}

// ══════════════════════════════════════════════════════════════════════════════
// AI CHAT
// ══════════════════════════════════════════════════════════════════════════════
const chatMessages = document.getElementById("chat-messages");
const chatInput    = document.getElementById("chat-input");
const chatSend     = document.getElementById("chat-send");

chatSend.addEventListener("click", sendChat);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
});

async function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg) return;
  chatInput.value = "";

  // User bubble
  chatMessages.appendChild(Object.assign(el("div", "bubble bubble-user"), { textContent: msg }));

  // Loading
  const loading = el("div", "loading-bubble", `AI が解析中 <span class="dots"><span>.</span><span>.</span><span>.</span></span>`);
  chatMessages.appendChild(loading);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const data = await api("/api/chat", "POST", { message: msg });
    loading.remove();
    renderAIResponse(data, msg);
  } catch (e) {
    loading.remove();
    chatMessages.appendChild(Object.assign(el("div", "bubble bubble-ai"), { textContent: "エラーが発生しました: " + e.message }));
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderAIResponse(data, originalInput = "") {
  const bubble = el("div", "bubble bubble-ai");
  const card   = el("div", "ai-response-card");

  if (data.error) {
    card.appendChild(Object.assign(el("p"), { textContent: "エラー: " + data.error }));
    bubble.appendChild(card);
    chatMessages.appendChild(bubble);
    return;
  }

  // Translation block (sentences only)
  if (data.translation) {
    const isEn = data.input_type === "english_sentence";
    const block = el("div", "translation-block");
    block.innerHTML = `<strong>${isEn ? "日本語訳" : "英語訳"}</strong>${escHtml(data.translation)}`;

    const actionsDiv = el("div", "translation-block-actions");
    const addSentenceBtn = el("button", "btn-ghost btn-sm", "文全体を単語帳に追加");
    addSentenceBtn.addEventListener("click", async () => {
      const vocabData = {
        word: isEn ? originalInput : data.translation,
        meaning: isEn ? data.translation : originalInput,
        pronunciation: "",
        katakana: "",
        part_of_speech: "フレーズ",
        example: "",
      };
      await api("/api/vocabulary", "POST", vocabData);
      addSentenceBtn.textContent = "✓ 追加済み";
      addSentenceBtn.disabled = true;
    });
    actionsDiv.appendChild(addSentenceBtn);
    block.appendChild(actionsDiv);
    card.appendChild(block);
  }

  // Word cards
  (data.words || []).forEach((w) => {
    if (w.is_hidden) return;
    card.appendChild(buildWordCard(w, data.input_type));
  });

  bubble.appendChild(card);
  chatMessages.appendChild(bubble);
}

function buildWordCard(w, inputType) {
  const isSentence = inputType === "english_sentence" || inputType === "japanese_sentence";
  const div = el("div", "word-card");

  // Header
  const hdr = el("div", "word-card-header");
  hdr.appendChild(Object.assign(el("span", "word-en"), { textContent: w.word }));
  hdr.appendChild(Object.assign(el("span", "word-pos"), { textContent: w.part_of_speech }));
  div.appendChild(hdr);

  div.appendChild(Object.assign(el("p", "word-meaning"), { textContent: w.meaning }));
  div.appendChild(Object.assign(el("p", "word-pron"), { textContent: `${w.pronunciation}  ${w.katakana}` }));

  const exampleBlock = el("div", "word-example-block");
  exampleBlock.appendChild(Object.assign(el("span", "word-example-label"), { textContent: "例文" }));
  exampleBlock.appendChild(Object.assign(el("p", "word-example"), { textContent: w.example }));
  if (w.example_translation) {
    exampleBlock.appendChild(Object.assign(el("p", "word-example-translation"), { textContent: w.example_translation }));
  }
  div.appendChild(exampleBlock);

  // Actions
  const actions = el("div", "word-card-actions");

  // Save to vocab button
  const saveBtn = el("button", "btn-ghost btn-sm", w.is_hidden ? "（非表示中）" : "単語帳に追加");
  if (!w.is_hidden) {
    saveBtn.addEventListener("click", async () => {
      await api("/api/vocabulary", "POST", w);
      saveBtn.textContent = "✓ 追加済み";
      saveBtn.disabled = true;
    });
  }
  actions.appendChild(saveBtn);

  // Hide toggle for sentence breakdowns
  if (isSentence) {
    const hideBtn = el("button", "btn-secondary btn-sm", w.is_hidden ? "非表示を解除" : "解説を非表示に");
    hideBtn.addEventListener("click", async () => {
      if (w.is_hidden) {
        await api(`/api/hidden/${encodeURIComponent(w.word)}`, "DELETE");
        w.is_hidden = false;
        hideBtn.textContent = "解説を非表示に";
        div.classList.remove("hidden-card");
        saveBtn.textContent = "単語帳に追加";
        saveBtn.disabled = false;
      } else {
        await api("/api/hidden", "POST", { word: w.word });
        div.remove();
      }
    });
    actions.appendChild(hideBtn);
  }

  div.appendChild(actions);
  return div;
}

// ══════════════════════════════════════════════════════════════════════════════
// VOCABULARY
// ══════════════════════════════════════════════════════════════════════════════
const vocabList    = document.getElementById("vocab-list");
const showMeanings = document.getElementById("show-meanings");
const vocabModal   = document.getElementById("vocab-modal");
const hiddenModal  = document.getElementById("hidden-modal");

showMeanings.addEventListener("change", renderVocabList);
document.querySelectorAll('input[name="vocab-sort"]').forEach((r) => r.addEventListener("change", renderVocabList));
document.getElementById("btn-show-hidden").addEventListener("click", openHiddenModal);

// Close modals
document.querySelectorAll(".modal-close").forEach((btn) => {
  btn.addEventListener("click", () => {
    vocabModal.classList.add("hidden");
    hiddenModal.classList.add("hidden");
  });
});
[vocabModal, hiddenModal].forEach((m) => {
  m.addEventListener("click", (e) => { if (e.target === m) m.classList.add("hidden"); });
});

let vocabCache = [];

async function loadVocab() {
  vocabCache = await api("/api/vocabulary");
  renderVocabList();
}

function renderVocabList() {
  const showM = showMeanings.checked;
  const sortBy = document.querySelector('input[name="vocab-sort"]:checked')?.value || "date";
  const list = [...vocabCache];
  if (sortBy === "difficulty") {
    list.sort((a, b) => b.difficulty - a.difficulty);
  }
  vocabList.innerHTML = "";
  if (!list.length) {
    vocabList.appendChild(el("p", "empty-state", "単語帳はまだ空です。AIチャットで単語を調べて追加しましょう。"));
    return;
  }
  list.forEach((v) => {
    const item = el("div", "vocab-item");
    item.appendChild(diffBadge(v.difficulty));
    item.appendChild(Object.assign(el("span", "vocab-word"), { textContent: v.word }));
    if (showM) item.appendChild(Object.assign(el("span", "vocab-meaning"), { textContent: v.meaning }));
    item.addEventListener("click", () => openVocabDetail(v.id));
    vocabList.appendChild(item);
  });
}

async function openVocabDetail(id) {
  const v = await api(`/api/vocabulary/${id}`);
  const body = document.getElementById("modal-body");

  const diffLabels = { 0: "なし", 1: "レベル1", 2: "レベル2", 3: "レベル3" };
  const diffColors = { 0: "#6b7280", 1: "#fbbf24", 2: "#ef4444", 3: "#9333ea" };

  body.innerHTML = `
    <p class="detail-word">${escHtml(v.word)}</p>
    <p class="detail-pos">${escHtml(v.part_of_speech || "")}</p>
    <dl>
      <div class="detail-section">
        <dt>日本語の意味</dt><dd>${escHtml(v.meaning || "")}</dd>
      </div>
      <div class="detail-section">
        <dt>発音記号</dt><dd>${escHtml(v.pronunciation || "")}</dd>
      </div>
      <div class="detail-section">
        <dt>カタカナ読み</dt><dd>${escHtml(v.katakana || "")}</dd>
      </div>
      <div class="detail-section">
        <dt>例文</dt><dd class="detail-example">${escHtml(v.example || "")}</dd>
      </div>
      <div class="detail-section">
        <dt>苦手度</dt>
        <dd style="color:${diffColors[v.difficulty]};font-weight:700">${diffLabels[v.difficulty]}</dd>
      </div>
    </dl>
    <div class="detail-delete">
      <button class="btn-danger btn-sm" id="btn-delete-vocab">単語帳から削除</button>
    </div>
  `;

  body.querySelector("#btn-delete-vocab").addEventListener("click", async () => {
    if (!confirm(`「${v.word}」を削除しますか？`)) return;
    await api(`/api/vocabulary/${id}`, "DELETE");
    vocabModal.classList.add("hidden");
    await loadVocab();
  });

  vocabModal.classList.remove("hidden");
}

async function openHiddenModal() {
  const list = document.getElementById("hidden-list");
  const words = await api("/api/hidden");
  list.innerHTML = "";
  if (!words.length) {
    list.appendChild(el("p", "empty-state", "非表示に設定した単語はありません。"));
    return;
  }
  words.forEach((hw) => {
    const item = el("div", "hidden-item");
    item.appendChild(Object.assign(el("span"), { textContent: hw.word }));
    const btn = el("button", "btn-ghost btn-sm", "解除");
    btn.addEventListener("click", async () => {
      await api(`/api/hidden/${encodeURIComponent(hw.word)}`, "DELETE");
      item.remove();
    });
    item.appendChild(btn);
    list.appendChild(item);
  });
  hiddenModal.classList.remove("hidden");
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════════════
const testListView   = document.getElementById("test-list-view");
const testTakeView   = document.getElementById("test-take-view");
const testResultView = document.getElementById("test-result-view");

document.getElementById("btn-gen-test").addEventListener("click", async () => {
  const res = await api("/api/tests/generate", "POST");
  if (res.error) { alert(res.error); return; }
  await loadTests();
  startTest(res.test_id);
});

document.getElementById("btn-back-tests").addEventListener("click", () => {
  showTestView("list");
  loadTests();
});

document.getElementById("btn-result-back").addEventListener("click", () => {
  showTestView("list");
  loadTests();
});

function showTestView(which) {
  testListView.classList.add("hidden");
  testTakeView.classList.add("hidden");
  testResultView.classList.add("hidden");
  if (which === "list")   testListView.classList.remove("hidden");
  if (which === "take")   testTakeView.classList.remove("hidden");
  if (which === "result") testResultView.classList.remove("hidden");
}

async function loadTests() {
  const tests = await api("/api/tests");
  const list  = document.getElementById("tests-list");
  list.innerHTML = "";
  if (!tests.length) {
    list.appendChild(el("p", "empty-state", "テストはまだありません。手動生成するか、アプリを再起動してください。"));
    return;
  }
  tests.forEach((t) => {
    const item = el("div", "test-item");
    const left = el("div");
    const date = el("p", "test-meta", t.created_at);
    const badge = el("span", t.completed_at ? "badge-done" : "badge-new", t.completed_at ? "完了" : "未受験");
    left.appendChild(date);
    left.appendChild(badge);

    const right = el("div", "test-score");
    if (t.completed_at) right.textContent = `${t.score} / ${t.total}`;

    item.appendChild(left);
    item.appendChild(right);
    item.addEventListener("click", () => startTest(t.id));
    list.appendChild(item);
  });
}

// ── Take test ─────────────────────────────────────────────────────────────────
let currentTest    = null;
let currentQIndex  = 0;
let answeredCount  = 0;

async function startTest(testId) {
  const detail = await api(`/api/tests/${testId}`);
  if (!detail || detail.error) { alert("テストが見つかりません"); return; }
  currentTest   = detail;
  currentQIndex = 0;
  answeredCount = 0;
  showTestView("take");
  showQuestion();
}

function showQuestion() {
  const qs   = currentTest.questions;
  const prog = document.getElementById("test-progress");
  prog.textContent = `${currentQIndex + 1} / ${qs.length}`;

  const area = document.getElementById("test-question-area");
  area.innerHTML = "";

  const q = qs[currentQIndex];
  const card = el("div", "question-card");

  card.appendChild(Object.assign(el("p", "question-word"), { textContent: q.word }));

  const revealBtn = el("button", "btn-primary", "答えを見る");
  card.appendChild(revealBtn);

  const answerArea = el("div", "answer-reveal hidden");
  answerArea.appendChild(Object.assign(el("p", "question-answer"), { textContent: q.meaning }));
  card.appendChild(answerArea);

  const judgeArea = el("div", "judge-buttons hidden");
  const correctBtn   = el("button", "btn-judge btn-judge-correct", "○");
  const incorrectBtn = el("button", "btn-judge btn-judge-incorrect", "×");
  judgeArea.appendChild(correctBtn);
  judgeArea.appendChild(incorrectBtn);
  card.appendChild(judgeArea);

  const nextBtn = el("button", "btn-secondary hidden");
  card.appendChild(nextBtn);

  area.appendChild(card);

  revealBtn.addEventListener("click", () => {
    revealBtn.classList.add("hidden");
    answerArea.classList.remove("hidden");
    judgeArea.classList.remove("hidden");
  });

  async function handleJudge(isCorrect) {
    correctBtn.disabled = true;
    incorrectBtn.disabled = true;
    judgeArea.classList.add("hidden");

    await api("/api/tests/answer", "POST", {
      question_id: q.id,
      user_answer: "",
      is_correct: isCorrect,
    });

    const feedback = el("div", `answer-feedback ${isCorrect ? "correct" : "incorrect"}`);
    feedback.textContent = isCorrect ? "○ わかった！" : "× わからなかった";
    card.insertBefore(feedback, nextBtn);

    answeredCount++;
    const isLast = currentQIndex >= currentTest.questions.length - 1;
    nextBtn.textContent = isLast ? "結果を見る" : "次の問題";
    nextBtn.classList.remove("hidden");
    nextBtn.onclick = async () => {
      if (isLast) {
        const result = await api(`/api/tests/${currentTest.test.id}/finish`, "POST");
        showResult(result);
      } else {
        currentQIndex++;
        showQuestion();
      }
    };
  }

  correctBtn.addEventListener("click", () => handleJudge(true));
  incorrectBtn.addEventListener("click", () => handleJudge(false));
}

function showResult(detail) {
  showTestView("result");
  const body = document.getElementById("test-result-body");
  const t    = detail.test;
  const qs   = detail.questions;

  body.innerHTML = `
    <p class="result-score">${t.score} / ${t.total}</p>
    <table class="result-table">
      <thead><tr><th>単語</th><th>正解</th><th>結果</th></tr></thead>
      <tbody>
        ${qs.map((q) => `
          <tr>
            <td>${escHtml(q.word)}</td>
            <td>${escHtml(q.meaning)}</td>
            <td class="${q.is_correct ? "ok" : "ng"}">${q.is_correct ? "○" : "×"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════════
function buildTimeSelect(value = "07:00") {
  const sel = document.createElement("select");
  sel.className = "s-time-select";
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, "0");
    const opt = document.createElement("option");
    opt.value = `${hh}:00`;
    opt.textContent = `${hh}:00`;
    if (opt.value === value) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}

function updateTimeSelects() {
  const count = parseInt(document.querySelector('input[name="s-daily"]:checked')?.value || "2");
  const container = document.getElementById("time-selects");
  const existing = Array.from(container.querySelectorAll(".s-time-select")).map((s) => s.value);
  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    container.appendChild(buildTimeSelect(existing[i] || (i === 0 ? "07:00" : "22:00")));
  }
}

document.querySelectorAll('input[name="s-daily"]').forEach((r) => {
  r.addEventListener("change", updateTimeSelects);
});

document.getElementById("btn-edit-settings").addEventListener("click", () => {
  document.getElementById("settings-display").classList.add("hidden");
  document.getElementById("settings-edit").classList.remove("hidden");
  document.getElementById("btn-edit-settings").classList.add("hidden");
  document.getElementById("btn-save-settings").classList.remove("hidden");
});

document.getElementById("btn-save-settings").addEventListener("click", async () => {
  const questions = document.querySelector('input[name="s-questions"]:checked')?.value || "10";
  const daily     = document.querySelector('input[name="s-daily"]:checked')?.value || "2";
  const timesArr  = Array.from(document.querySelectorAll(".s-time-select")).map((s) => s.value);

  await api("/api/settings", "POST", {
    questions_per_test: questions,
    daily_count:        daily,
    generation_times:   JSON.stringify(timesArr),
  });

  document.getElementById("settings-display").classList.remove("hidden");
  document.getElementById("settings-edit").classList.add("hidden");
  document.getElementById("btn-edit-settings").classList.remove("hidden");
  document.getElementById("btn-save-settings").classList.add("hidden");

  await loadSettings();

  const msg = document.getElementById("settings-msg");
  msg.textContent = "✓ 保存しました";
  setTimeout(() => { msg.textContent = ""; }, 2000);
});

async function loadSettings() {
  const s = await api("/api/settings");
  const questions = parseInt(s.questions_per_test || 10);
  const daily     = parseInt(s.daily_count || 2);
  let times;
  try { times = JSON.parse(s.generation_times || '["07:00","22:00"]'); }
  catch { times = ["07:00", "22:00"]; }

  // 表示エリア更新
  document.getElementById("disp-questions").textContent = `${questions}問`;
  document.getElementById("disp-daily").textContent     = `${daily}回`;
  document.getElementById("disp-times").textContent     = times.join("、");

  // ラジオボタン設定
  const qRadio = document.querySelector(`input[name="s-questions"][value="${questions}"]`);
  if (qRadio) qRadio.checked = true;
  const dRadio = document.querySelector(`input[name="s-daily"][value="${daily}"]`);
  if (dRadio) dRadio.checked = true;

  // 時刻セレクト構築
  const container = document.getElementById("time-selects");
  container.innerHTML = "";
  for (let i = 0; i < daily; i++) {
    container.appendChild(buildTimeSelect(times[i] || "07:00"));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Utility
// ══════════════════════════════════════════════════════════════════════════════
function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Init
showTestView("list");
