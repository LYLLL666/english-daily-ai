/**
 * English Daily AI — 免费资源 · 四级分组（每组 50 词）
 */
(function () {
  const KEYS = {
    favorites: "eda_favorites",
    wrong: "eda_wrong",
    group: "eda_group",
    phonetic: "eda_phonetic_cache",
  };

  const VIEW_TITLES = {
    home: "English Daily AI",
    lookup: "查单词",
    memorize: "记单词",
    practice: "练习",
    favorites: "收藏",
    wrong: "错题",
    chat: "AI 聊天",
  };

  const META = window.CET4_META || { groupSize: 50, totalGroups: 1, totalWords: 0 };
  const CET4_LIST = (window.CET4_WORDS || []).map((x) => ({
    word: x.word,
    zh: x.zh,
    phonetic: x.phonetic || "",
    ex: x.ex || "",
    exZh: x.exZh || "",
    group: x.group ?? 0,
  }));
  const CET4_MAP = new Map(CET4_LIST.map((x) => [x.word, x]));

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function normalizeWord(w) {
    return String(w || "")
      .trim()
      .toLowerCase();
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ── 分组 ── */
  function getGroup() {
    const g = parseInt(load(KEYS.group, 0), 10);
    return Number.isFinite(g) && g >= 0 && g < META.totalGroups ? g : 0;
  }

  function setGroup(g) {
    save(KEYS.group, g);
    syncGroupSelects();
  }

  function wordsInGroup(g) {
    return CET4_LIST.filter((w) => w.group === g);
  }

  function groupLabel(g) {
    return `第 ${g + 1} 组`;
  }

  function getWordGroup(word) {
    const hit = getCet4Word(word);
    return hit ? hit.group : getGroup();
  }

  function getCet4Word(word) {
    return CET4_MAP.get(normalizeWord(word)) || null;
  }

  function fillGroupSelect(select) {
    if (!select) return;
    select.innerHTML = "";
    for (let g = 0; g < META.totalGroups; g++) {
      const opt = document.createElement("option");
      const n = wordsInGroup(g).length;
      opt.value = String(g);
      opt.textContent = `${groupLabel(g)}（${n} 词）`;
      select.appendChild(opt);
    }
    select.value = String(getGroup());
  }

  function syncGroupSelects() {
    const g = String(getGroup());
    ["mem-group-select", "practice-group-select", "fav-group-select", "wrong-group-select"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.value = g;
      }
    );
  }

  function bindGroupSelect(id, onChange) {
    const el = document.getElementById(id);
    if (!el) return;
    fillGroupSelect(el);
    el.addEventListener("change", () => {
      setGroup(parseInt(el.value, 10));
      onChange?.();
    });
  }

  /* ── 发音 ── */
  function speakWord(word) {
    if (!word || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = "en-US";
    u.rate = 0.88;
    window.speechSynthesis.speak(u);
  }

  /* ── 音标缓存（免费词典 API）── */
  let phoneticCache = load(KEYS.phonetic, {});

  function savePhoneticCache() {
    save(KEYS.phonetic, phoneticCache);
  }

  async function fetchPhonetic(word) {
    const w = normalizeWord(word);
    if (phoneticCache[w]) return phoneticCache[w];
    const hit = getCet4Word(w);
    if (hit?.phonetic) return hit.phonetic;

    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`
      );
      if (!res.ok) return "";
      const data = await res.json();
      const p =
        data[0]?.phonetic || data[0]?.phonetics?.find((x) => x.text)?.text || "";
      if (p) {
        phoneticCache[w] = p;
        savePhoneticCache();
        if (hit) hit.phonetic = p;
      }
      return p;
    } catch {
      return "";
    }
  }

  async function displayPhonetic(el, word, item) {
    if (!el) return;
    const cached = item?.phonetic || phoneticCache[normalizeWord(word)];
    if (cached) {
      el.textContent = cached;
      return;
    }
    el.textContent = "加载音标…";
    const p = await fetchPhonetic(word);
    el.textContent = p || "—";
  }

  /* ── 免费中文 ── */
  async function fetchChinese(word) {
    const hit = getCet4Word(word);
    if (hit) return hit.zh;
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh-CN`
      );
      const data = await res.json();
      const text = data?.responseData?.translatedText;
      if (text && text.toLowerCase() !== word.toLowerCase()) return text;
    } catch {
      /* ignore */
    }
    return "";
  }

  /* ── Navigation ── */
  const backBtn = $("#back-btn");
  const brandHome = $("#brand-home");
  const viewTitle = $("#view-title");

  function showView(name) {
    $$(".view").forEach((el) => {
      el.classList.toggle("view--active", el.dataset.view === name);
    });
    const isHome = name === "home";
    backBtn.classList.toggle("hidden", isHome);
    brandHome.classList.toggle("hidden", !isHome);
    viewTitle.classList.toggle("hidden", isHome);
    if (!isHome) viewTitle.textContent = VIEW_TITLES[name] || name;
    document.title = isHome ? "English Daily AI" : `${VIEW_TITLES[name]} · English Daily AI`;

    if (name === "favorites") renderFavorites();
    if (name === "wrong") renderWrong();
    if (name === "memorize") showMemCard();
    if (name === "practice") updatePracticeHint();
  }

  $$("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.go));
  });
  backBtn.addEventListener("click", () => showView("home"));

  /* ── Favorites ── */
  function getFavorites() {
    return load(KEYS.favorites, []);
  }

  function setFavorites(list) {
    save(KEYS.favorites, list);
  }

  function isFavorited(word) {
    return getFavorites().some((f) => normalizeWord(f.word) === normalizeWord(word));
  }

  function addFavorite(entry) {
    const w = normalizeWord(entry.word);
    if (!w || isFavorited(w)) return false;
    const cet = getCet4Word(w);
    getFavorites().unshift({
      id: uid(),
      word: entry.word.trim(),
      zh: entry.zh || cet?.zh || "",
      phonetic: entry.phonetic || cet?.phonetic || "",
      ex: entry.ex || cet?.ex || "",
      exZh: entry.exZh || cet?.exZh || "",
      group: entry.group ?? getWordGroup(w),
      source: entry.source || "lookup",
      addedAt: Date.now(),
    });
    setFavorites(getFavorites());
    return true;
  }

  function removeFavorite(id) {
    setFavorites(getFavorites().filter((f) => f.id !== id));
    renderFavorites();
  }

  function renderFavorites() {
    const g = parseInt($("#fav-group-select")?.value ?? getGroup(), 10);
    const list = getFavorites().filter((f) => f.group === g);
    const ul = $("#fav-list");
    const empty = $("#fav-empty");
    ul.innerHTML = "";
    empty.classList.toggle("hidden", list.length > 0);
    list.forEach((f) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="word-list-main">
          <strong>${escapeHtml(f.word)}</strong>
          <span>${escapeHtml(f.zh || "—")}</span>
          ${f.ex ? `<div class="word-list-meta">${escapeHtml(f.ex)}</div>` : ""}
        </div>
        <div class="word-list-actions">
          <button type="button" class="icon-btn glass-btn" data-speak="${escapeHtml(f.word)}">🔊</button>
          <button type="button" class="icon-btn icon-btn--danger glass-btn" data-rm="${f.id}">删</button>
        </div>`;
      ul.appendChild(li);
    });
    ul.querySelectorAll("[data-rm]").forEach((b) =>
      b.addEventListener("click", () => removeFavorite(b.dataset.rm))
    );
    ul.querySelectorAll("[data-speak]").forEach((b) =>
      b.addEventListener("click", () => speakWord(b.dataset.speak))
    );
  }

  /* ── Wrong ── */
  function getWrong() {
    return load(KEYS.wrong, []);
  }

  function setWrong(list) {
    save(KEYS.wrong, list);
  }

  function addWrong(entry) {
    getWrong().unshift({
      id: uid(),
      word: entry.word,
      zh: entry.zh,
      group: entry.group ?? getGroup(),
      userAnswer: entry.userAnswer,
      correctAnswer: entry.correctAnswer,
      addedAt: Date.now(),
    });
    setWrong(getWrong().slice(0, 300));
  }

  function renderWrong() {
    const g = parseInt($("#wrong-group-select")?.value ?? getGroup(), 10);
    const list = getWrong().filter((w) => w.group === g);
    const ul = $("#wrong-list");
    const empty = $("#wrong-empty");
    ul.innerHTML = "";
    empty.classList.toggle("hidden", list.length > 0);
    list.forEach((w) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="word-list-main">
          <strong>${escapeHtml(w.word)}</strong>
          <span>正确：${escapeHtml(w.correctAnswer)}</span>
          <div class="word-list-meta">你的选择：${escapeHtml(w.userAnswer)}</div>
        </div>
        <div class="word-list-actions">
          <button type="button" class="icon-btn glass-btn" data-speak="${escapeHtml(w.word)}">🔊</button>
          <button type="button" class="icon-btn icon-btn--danger glass-btn" data-rm="${w.id}">删</button>
        </div>`;
      ul.appendChild(li);
    });
    ul.querySelectorAll("[data-rm]").forEach((b) => {
      b.addEventListener("click", () => {
        setWrong(getWrong().filter((x) => x.id !== b.dataset.rm));
        renderWrong();
      });
    });
    ul.querySelectorAll("[data-speak]").forEach((b) =>
      b.addEventListener("click", () => speakWord(b.dataset.speak))
    );
  }

  $("#wrong-clear").addEventListener("click", () => {
    const g = parseInt($("#wrong-group-select")?.value ?? getGroup(), 10);
    if (!confirm(`确定清空${groupLabel(g)}的全部错题？`)) return;
    setWrong(getWrong().filter((w) => w.group !== g));
    renderWrong();
  });

  /* ── Lookup ── */
  async function fetchDefinition(word) {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    if (!res.ok) throw new Error("未找到该单词。");
    const entry = (await res.json())[0];
    const phonetic = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text || "";
    const defs = [];
    let ex = "";
    (entry.meanings || []).forEach((m) => {
      (m.definitions || []).slice(0, 2).forEach((d) => {
        defs.push({ pos: m.partOfSpeech, text: d.definition });
        if (!ex && d.example) ex = d.example;
      });
    });
    for (const m of entry.meanings || []) {
      for (const d of m.definitions || []) {
        if (d.example) {
          ex = d.example;
          break;
        }
      }
      if (ex) break;
    }
    const enDef = defs.map((d) => `[${d.pos}] ${d.text}`).join("；");
    return { word: entry.word, phonetic, enDef, defs, ex };
  }

  function renderLookupResult(data) {
    const box = $("#lookup-result");
    box.classList.remove("hidden");
    $("#lookup-error").classList.add("hidden");
    const cet = getCet4Word(data.word);
    const ex = data.ex || cet?.ex || "";
    const exZh = cet?.exZh || (data.zh ? `释义：${data.zh}` : "");
    const favLabel = isFavorited(data.word) ? "已收藏" : "☆ 收藏";

    box.innerHTML = `
      <div class="word-card-head">
        <div>
          <p class="lookup-word">${escapeHtml(data.word)}</p>
          <p class="lookup-phonetic" id="lookup-ph">${escapeHtml(data.phonetic || "—")}</p>
        </div>
        <button type="button" class="speak-btn glass-btn" id="lookup-speak">🔊</button>
      </div>
      <p class="lookup-zh">${escapeHtml(data.zh || "—")}</p>
      ${
        ex
          ? `<div class="lookup-ex glass-inset">
        <p class="ex-label">例句</p>
        <p class="ex-en">${escapeHtml(ex)}</p>
        ${exZh ? `<p class="ex-zh">${escapeHtml(exZh)}</p>` : ""}
      </div>`
          : ""
      }
      ${data.enDef ? `<p class="hint" style="margin-top:0.75rem">${escapeHtml(data.enDef)}</p>` : ""}
      <div class="lookup-actions">
        <button type="button" class="btn btn-primary glass-btn btn-sm" id="lookup-fav">${favLabel}</button>
      </div>`;

    if (!data.phonetic) displayPhonetic($("#lookup-ph"), data.word, cet);
    $("#lookup-speak").addEventListener("click", () => speakWord(data.word));
    $("#lookup-fav").addEventListener("click", () => {
      if (isFavorited(data.word)) return;
      addFavorite({
        word: data.word,
        phonetic: data.phonetic,
        zh: data.zh,
        ex,
        exZh,
        group: getWordGroup(data.word),
        source: "lookup",
      });
      $("#lookup-fav").textContent = "已收藏";
    });
  }

  $("#lookup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const word = normalizeWord($("#lookup-input").value);
    const errEl = $("#lookup-error");
    $("#lookup-result").classList.add("hidden");
    if (!word) {
      errEl.textContent = "请输入单词。";
      errEl.classList.remove("hidden");
      return;
    }
    errEl.textContent = "查询中…";
    errEl.classList.remove("hidden");
    errEl.classList.remove("msg--error");
    try {
      const cet = getCet4Word(word);
      const [dict, zh] = await Promise.all([
        fetchDefinition(word).catch(() => null),
        cet ? Promise.resolve(cet.zh) : fetchChinese(word),
      ]);
      const data = {
        word: dict?.word || word,
        phonetic: dict?.phonetic || cet?.phonetic || "",
        zh: zh || "",
        enDef: dict?.enDef || "",
        ex: dict?.ex || cet?.ex || "",
      };
      errEl.classList.add("hidden");
      renderLookupResult(data);
      speakWord(data.word);
    } catch (err) {
      errEl.textContent = err.message || "查询失败";
      errEl.classList.add("msg--error");
    }
  });

  /* ── Memorize ── */
  let memIndex = 0;
  let memDeck = [];

  function resetMemDeck() {
    memDeck = wordsInGroup(getGroup());
    memIndex = 0;
  }

  function showMemCard() {
    if (!memDeck.length) resetMemDeck();
    if (!memDeck.length) return;

    if (memIndex >= memDeck.length) memIndex = 0;
    const item = memDeck[memIndex];

    $("#mem-word").textContent = item.word;
    $("#mem-zh").textContent = item.zh;
    $("#mem-ex").textContent = item.ex || "—";
    $("#mem-ex-zh").textContent = item.exZh || "—";
    $("#mem-progress").textContent = `${memIndex + 1} / ${memDeck.length} · ${groupLabel(item.group)}`;
    $("#mem-fav").textContent = isFavorited(item.word) ? "已收藏" : "☆ 收藏";

    displayPhonetic($("#mem-phonetic"), item.word, item);
    speakWord(item.word);
  }

  bindGroupSelect("mem-group-select", () => {
    resetMemDeck();
    showMemCard();
  });

  $("#mem-speak").addEventListener("click", () => speakWord(memDeck[memIndex]?.word));
  $("#mem-prev").addEventListener("click", () => {
    memIndex = (memIndex - 1 + memDeck.length) % memDeck.length;
    showMemCard();
  });
  $("#mem-next").addEventListener("click", () => {
    memIndex = (memIndex + 1) % memDeck.length;
    showMemCard();
  });
  $("#mem-fav").addEventListener("click", () => {
    const item = memDeck[memIndex];
    if (!item || isFavorited(item.word)) return;
    addFavorite({ ...item, source: "memorize" });
    $("#mem-fav").textContent = "已收藏";
  });

  /* ── Practice ── */
  const QUIZ_SIZE = 10;
  let quizItems = [];
  let quizIndex = 0;
  let quizScore = 0;
  let quizAnswered = false;
  let practiceGroup = 0;

  function updatePracticeHint() {
    const g = parseInt($("#practice-group-select")?.value ?? getGroup(), 10);
    const n = wordsInGroup(g).length;
    $("#practice-pool-count").textContent = `${groupLabel(g)}共 ${n} 词，每次最多 ${Math.min(QUIZ_SIZE, n)} 题`;
  }

  function startPractice() {
    practiceGroup = parseInt($("#practice-group-select")?.value ?? getGroup(), 10);
    const pool = wordsInGroup(practiceGroup);
    if (pool.length < 4) {
      alert("该组单词不足 4 个，无法练习。");
      return;
    }
    quizItems = shuffle(pool).slice(0, Math.min(QUIZ_SIZE, pool.length));
    quizIndex = 0;
    quizScore = 0;
    $("#practice-start").classList.add("hidden");
    $("#practice-done").classList.add("hidden");
    $("#practice-quiz").classList.remove("hidden");
    showQuizQuestion();
  }

  async function showQuizQuestion() {
    quizAnswered = false;
    const item = quizItems[quizIndex];
    const pool = wordsInGroup(practiceGroup).filter((p) => p.word !== item.word);
    const options = shuffle([item.zh, ...shuffle(pool).slice(0, 3).map((p) => p.zh)]);

    $("#quiz-index").textContent = `${quizIndex + 1} / ${quizItems.length} · ${groupLabel(practiceGroup)}`;
    $("#quiz-score").textContent = `得分 ${quizScore}`;
    $("#quiz-word").textContent = item.word;
    $("#quiz-feedback").classList.add("hidden");
    $("#quiz-next").classList.add("hidden");

    displayPhonetic($("#quiz-phonetic"), item.word, item);
    speakWord(item.word);

    const optsEl = $("#quiz-options");
    optsEl.innerHTML = "";
    options.forEach((zh) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.textContent = zh;
      btn.addEventListener("click", () => onQuizAnswer(btn, item, zh));
      optsEl.appendChild(btn);
    });
  }

  function onQuizAnswer(btn, item, chosen) {
    if (quizAnswered) return;
    quizAnswered = true;
    const correctZh = item.zh;
    const isRight = chosen === correctZh;

    $$(".quiz-option", $("#quiz-options")).forEach((b) => {
      b.disabled = true;
      if (b.textContent === correctZh) b.classList.add("is-correct");
      if (b === btn && !isRight) b.classList.add("is-wrong");
    });

    const fb = $("#quiz-feedback");
    fb.classList.remove("hidden");
    if (isRight) {
      quizScore++;
      fb.textContent = "回答正确！";
      fb.className = "msg msg--success";
    } else {
      fb.textContent = `答错了，正确：${correctZh}`;
      fb.className = "msg msg--error";
      addWrong({
        word: item.word,
        zh: correctZh,
        group: practiceGroup,
        userAnswer: chosen,
        correctAnswer: correctZh,
      });
    }
    $("#quiz-score").textContent = `得分 ${quizScore}`;
    $("#quiz-next").classList.remove("hidden");
  }

  $("#quiz-speak").addEventListener("click", () => speakWord(quizItems[quizIndex]?.word));
  $("#quiz-next").addEventListener("click", () => {
    quizIndex++;
    if (quizIndex >= quizItems.length) {
      $("#practice-quiz").classList.add("hidden");
      $("#practice-done").classList.remove("hidden");
      $("#practice-summary").textContent = `${groupLabel(practiceGroup)}：共 ${quizItems.length} 题，答对 ${quizScore} 题。`;
    } else {
      showQuizQuestion();
    }
  });

  $("#practice-begin").addEventListener("click", startPractice);
  $("#practice-restart").addEventListener("click", () => {
    $("#practice-done").classList.add("hidden");
    $("#practice-start").classList.remove("hidden");
    updatePracticeHint();
  });

  bindGroupSelect("practice-group-select", updatePracticeHint);
  bindGroupSelect("fav-group-select", renderFavorites);
  bindGroupSelect("wrong-group-select", renderWrong);

  /* ── AI Chat ── */
  function getApiConfig() {
    return window.AI_CONFIG || { endpoint: "", apiKey: "", model: "gpt-4o-mini" };
  }

  function appendChatBubble(text, role) {
    const div = document.createElement("div");
    div.className = `chat-bubble chat-bubble--${role} glass`;
    const p = document.createElement("p");
    p.textContent = text;
    div.appendChild(p);
    $("#chat-messages").appendChild(div);
    div.scrollIntoView({ behavior: "smooth", block: "end" });
    return div;
  }

  async function callAiApi(userMessage, history) {
    const cfg = getApiConfig();
    if (!cfg.endpoint || !cfg.apiKey) {
      throw new Error("AI 未配置：请在 config.js 填写 endpoint 与 apiKey。");
    }
    const res = await fetch(cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are English Daily AI, a friendly CET-4 English tutor.",
          },
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: userMessage },
        ],
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`API 错误 (${res.status})`);
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) throw new Error("无法解析 API 返回。");
    return reply;
  }

  const chatHistory = [];
  $("#chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = $("#chat-input").value.trim();
    if (!text) return;
    $("#chat-input").value = "";
    appendChatBubble(text, "user");
    chatHistory.push({ role: "user", content: text });
    const loading = appendChatBubble("思考中…", "ai");
    try {
      const reply = await callAiApi(text, chatHistory.slice(0, -1));
      loading.remove();
      appendChatBubble(reply, "ai");
      chatHistory.push({ role: "assistant", content: reply });
    } catch (err) {
      loading.remove();
      appendChatBubble(err.message || "失败", "error");
    }
  });

  /* ── Init ── */
  $("#home-total-words").textContent = String(META.totalWords || CET4_LIST.length);
  $("#home-total-groups").textContent = String(META.totalGroups);
  resetMemDeck();
  syncGroupSelects();
  showView("home");
})();
