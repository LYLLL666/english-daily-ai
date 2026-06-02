/**
 * English Daily AI — 免费资源 · 四级分组（每组 50 词）
 */
(function () {
  const KEYS = {
    favorites: "eda_favorites",
    wrong: "eda_wrong",
    group: "eda_group",
    phonetic: "eda_phonetic_cache",
    quiz: "eda_quiz_state",
    chat: "eda_chat_history",
    practiceSplit: "eda_practice_split",
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

  /* ── 发音（Oxford 真人音频 + TTS 兜底）── */
  let currentAudio = null;

  function ttsFallback(word) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }

  function speakWord(word) {
    if (!word) return;
    const clean = String(word).toLowerCase().trim();
    if (!clean) return;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (currentAudio) {
      try { currentAudio.pause(); } catch {}
      currentAudio = null;
    }
    const audio = new Audio(
      `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(clean)}--_us_1.mp3`
    );
    currentAudio = audio;
    let fellBack = false;
    const fall = () => {
      if (fellBack) return;
      fellBack = true;
      ttsFallback(clean);
    };
    audio.onerror = fall;
    audio.play().catch(fall);
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
    if (name === "wrong") showWrongList();
    if (name === "memorize") showMemCard();
    if (name === "practice") onEnterPractice();
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
    const favs = getFavorites();
    favs.unshift({
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
    setFavorites(favs);
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
    const wrongs = getWrong();
    wrongs.unshift({
      id: uid(),
      word: entry.word,
      zh: entry.zh,
      group: entry.group ?? getGroup(),
      userAnswer: entry.userAnswer,
      correctAnswer: entry.correctAnswer,
      addedAt: Date.now(),
    });
    setWrong(wrongs.slice(0, 300));
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

  /* ── 错题专属复习模式 ── */
  let wrongReviewList = [];
  let wrongReviewIndex = 0;
  let wrongReviewRight = 0;
  let wrongReviewAdvanceTimer = null;
  let wrongReviewAnswered = false;

  function showWrongList() {
    if (wrongReviewAdvanceTimer) {
      clearTimeout(wrongReviewAdvanceTimer);
      wrongReviewAdvanceTimer = null;
    }
    $("#wrong-list-view").classList.remove("hidden");
    $("#wrong-review-view").classList.add("hidden");
    $("#wrong-review-done").classList.add("hidden");
    renderWrong();
  }

  function startWrongReview() {
    const g = parseInt($("#wrong-group-select")?.value ?? getGroup(), 10);
    const list = getWrong().filter((w) => w.group === g);
    if (!list.length) {
      alert("该组暂无错题可复习。");
      return;
    }
    wrongReviewList = shuffle(list);
    wrongReviewIndex = 0;
    wrongReviewRight = 0;
    $("#wrong-list-view").classList.add("hidden");
    $("#wrong-review-view").classList.remove("hidden");
    $("#wrong-review-done").classList.add("hidden");
    showWrongReviewQuestion();
  }

  function showWrongReviewQuestion() {
    if (wrongReviewAdvanceTimer) {
      clearTimeout(wrongReviewAdvanceTimer);
      wrongReviewAdvanceTimer = null;
    }
    wrongReviewAnswered = false;
    if (wrongReviewIndex >= wrongReviewList.length) {
      finishWrongReview();
      return;
    }
    const w = wrongReviewList[wrongReviewIndex];
    const cet = getCet4Word(w.word) || w;
    const correctZh = w.correctAnswer || w.zh || cet.zh || "";
    const distractorPool = CET4_LIST.filter(
      (p) => p.word !== w.word && p.zh && p.zh !== correctZh
    );
    const distractors = shuffle(distractorPool).slice(0, 3).map((p) => p.zh);
    const options = shuffle([correctZh, ...distractors]);

    $("#wrong-review-index").textContent = `${wrongReviewIndex + 1} / ${wrongReviewList.length}`;
    $("#wrong-review-word").textContent = w.word;
    $("#wrong-review-feedback").classList.add("hidden");

    displayPhonetic($("#wrong-review-phonetic"), w.word, cet);
    speakWord(w.word);

    const optsEl = $("#wrong-review-options");
    optsEl.innerHTML = "";
    options.forEach((zh) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.textContent = zh;
      btn.addEventListener("click", () => onWrongReviewAnswer(btn, w, zh, correctZh));
      optsEl.appendChild(btn);
    });
  }

  function onWrongReviewAnswer(btn, w, chosen, correctZh) {
    if (wrongReviewAnswered) return;
    wrongReviewAnswered = true;
    const isRight = chosen === correctZh;

    $$(".quiz-option", $("#wrong-review-options")).forEach((b) => {
      b.disabled = true;
      if (b.textContent === correctZh) b.classList.add("is-correct");
      if (b === btn && !isRight) b.classList.add("is-wrong");
    });

    const fb = $("#wrong-review-feedback");
    fb.classList.remove("hidden");
    if (isRight) {
      wrongReviewRight++;
      fb.textContent = "回答正确！已从错题本移除。";
      fb.className = "msg msg--success";
      // 从错题本移除
      setWrong(getWrong().filter((x) => x.id !== w.id));
    } else {
      fb.textContent = `答错了，正确：${correctZh}`;
      fb.className = "msg msg--error";
    }

    wrongReviewAdvanceTimer = setTimeout(() => {
      wrongReviewIndex++;
      showWrongReviewQuestion();
    }, isRight ? 600 : 1800);
  }

  function finishWrongReview() {
    $("#wrong-review-options").innerHTML = "";
    $("#wrong-review-feedback").classList.add("hidden");
    $("#wrong-review-done").classList.remove("hidden");
    const total = wrongReviewList.length;
    const tip = END_TIPS[Math.floor(Math.random() * END_TIPS.length)];
    $("#wrong-review-summary").textContent = `共 ${total} 题，答对 ${wrongReviewRight} 题。\n\n${tip}`;
  }

  $("#wrong-start-review").addEventListener("click", startWrongReview);
  $("#wrong-review-exit").addEventListener("click", showWrongList);
  $("#wrong-review-back").addEventListener("click", showWrongList);
  $("#wrong-review-speak").addEventListener("click", () =>
    speakWord(wrongReviewList[wrongReviewIndex]?.word)
  );

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
      (m.definitions || []).forEach((d, i) => {
        if (i < 2) defs.push({ pos: m.partOfSpeech, text: d.definition });
        if (!ex && d.example) ex = d.example;
      });
    });
    const enDef = defs.map((d) => `[${d.pos}] ${d.text}`).join("；");
    return { word: entry.word, phonetic, enDef, defs, ex };
  }

  async function fetchAiLookup(word) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message:
          `请查询英文单词"${word}"，严格只返回以下 JSON 格式（不要 markdown 代码块，不要任何其他文字）：\n` +
          `{\n  "word": "${word}",\n  "phonetic": "IPA 音标，如 /ˈeksəmpəl/",\n  "meaning_cn": "中文释义（含词性，如 n. 例子）",\n  "meaning_en": "英文释义",\n  "example": "英文例句",\n  "example_cn": "例句中文翻译"\n}`,
      }),
    });
    if (!res.ok) throw new Error(`AI 查询失败 (${res.status})`);
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const json = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const m = json.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("AI 返回格式不正确");
    const parsed = JSON.parse(m[0]);
    return {
      word: parsed.word || word,
      phonetic: parsed.phonetic || "",
      zh: parsed.meaning_cn || "",
      enDef: parsed.meaning_en || "",
      ex: parsed.example || "",
      exZh: parsed.example_cn || "",
    };
  }

  function renderLookupResult(data) {
    const box = $("#lookup-result");
    box.classList.remove("hidden");
    $("#lookup-error").classList.add("hidden");
    const cet = getCet4Word(data.word);
    const ex = data.ex || cet?.ex || "";
    const exZh = data.exZh || cet?.exZh || "";
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
      errEl.classList.add("msg--error");
      return;
    }
    errEl.textContent = "查询中…";
    errEl.classList.remove("hidden");
    errEl.classList.remove("msg--error");
    try {
      const cet = getCet4Word(word);
      // 优先 AI；失败时回退到免费 API + 翻译 API
      let data = null;
      try {
        const ai = await fetchAiLookup(word);
        data = {
          word: ai.word || word,
          phonetic: ai.phonetic || cet?.phonetic || "",
          zh: ai.zh || cet?.zh || "",
          enDef: ai.enDef || "",
          ex: ai.ex || cet?.ex || "",
          exZh: ai.exZh || cet?.exZh || "",
        };
      } catch (aiErr) {
        const [dict, zh] = await Promise.all([
          fetchDefinition(word).catch(() => null),
          cet ? Promise.resolve(cet.zh) : fetchChinese(word),
        ]);
        data = {
          word: dict?.word || word,
          phonetic: dict?.phonetic || cet?.phonetic || "",
          zh: zh || "",
          enDef: dict?.enDef || "",
          ex: dict?.ex || cet?.ex || "",
          exZh: cet?.exZh || "",
        };
      }
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
  const PRACTICE_SPLIT_SIZE = 25;
  let quizItems = [];
  let quizIndex = 0;
  let quizScore = 0;
  let quizAnswered = false;
  let practiceGroup = 0;
  let currentRound = 0;
  let quizAnswers = [];
  let quizAdvanceTimer = null;

  const END_TIPS = [
    "好啦，这一组做完了哦～先别急着继续，起来走一走也好呀 学习之外的世界也很有意思的！",
    "这一组结束啦，辛苦你啦～要不要先休息一下？看看窗外、喝口水也可以呀 不用一直待在这里的。",
    "做完这一部分啦～可以先放松一下哦 学习很重要，但生活里还有好多可爱的事情等你去发现呢。",
    "这一组已经搞定啦～先别继续刷了嘛，出去动一动或者发会儿呆都很好 真的不用一直学的呀。",
    "完成这一组啦～奖励自己休息一下吧 生活又不只有学习，对吧？慢一点也没关系的～",
  ];

  function getPracticeSplit(g) {
    return load(KEYS.practiceSplit + "_" + g, null);
  }

  function savePracticeSplit(g, split) {
    save(KEYS.practiceSplit + "_" + g, split);
  }

  function loadQuizState() {
    return load(KEYS.quiz, null);
  }

  function saveQuizState() {
    if (!quizItems.length) {
      localStorage.removeItem(KEYS.quiz);
      return;
    }
    save(KEYS.quiz, {
      group: practiceGroup,
      items: quizItems.map((it) => it.word),
      index: quizIndex,
      score: quizScore,
      answers: quizAnswers,
      round: currentRound,
    });
  }

  function clearQuizState() {
    localStorage.removeItem(KEYS.quiz);
  }

  function updatePracticeHint() {
    const g = parseInt($("#practice-group-select")?.value ?? getGroup(), 10);
    const pool = wordsInGroup(g);
    const perRound = Math.min(PRACTICE_SPLIT_SIZE, Math.ceil(pool.length / 2));
    const split = getPracticeSplit(g);
    let roundInfo = "";
    if (split && split.round0Done && !split.round1Done) {
      roundInfo = " · 第1轮已完成，可开始第2轮";
    } else if (split && split.round0Done && split.round1Done) {
      roundInfo = " · 两轮均已完成，将重新出题";
    }
    $("#practice-pool-count").textContent = `${groupLabel(g)}共 ${pool.length} 词，每轮 ${perRound} 题${roundInfo}`;
  }

  function startPractice() {
    practiceGroup = parseInt($("#practice-group-select")?.value ?? getGroup(), 10);
    const pool = wordsInGroup(practiceGroup);
    const perRound = Math.min(PRACTICE_SPLIT_SIZE, Math.ceil(pool.length / 2));
    if (pool.length < 4) {
      alert("该组单词不足 4 个，无法练习。");
      return;
    }

    // 取或建 split：把整组单词随机分成两轮，互不重复
    let split = getPracticeSplit(practiceGroup);
    if (!split || !split.set0 || (split.round0Done && split.round1Done)) {
      const shuffled = shuffle(pool);
      split = {
        set0: shuffled.slice(0, perRound),
        set1: shuffled.slice(perRound, perRound * 2),
        round0Done: false,
        round1Done: false,
      };
      savePracticeSplit(practiceGroup, split);
    }

    if (!split.round0Done) {
      quizItems = split.set0;
      currentRound = 0;
    } else {
      quizItems = split.set1;
      currentRound = 1;
    }

    quizIndex = 0;
    quizScore = 0;
    quizAnswers = [];
    saveQuizState();
    $("#practice-start").classList.add("hidden");
    $("#practice-done").classList.add("hidden");
    $("#practice-quiz").classList.remove("hidden");
    showQuizQuestion();
  }

  function restoreQuiz() {
    const st = loadQuizState();
    if (!st || !Array.isArray(st.items) || !st.items.length) return false;
    const pool = wordsInGroup(st.group);
    const items = st.items.map((w) => pool.find((p) => p.word === w)).filter(Boolean);
    if (items.length !== st.items.length) {
      clearQuizState();
      return false;
    }
    practiceGroup = st.group;
    quizItems = items;
    quizIndex = Math.min(st.index ?? 0, quizItems.length - 1);
    quizScore = st.score ?? 0;
    quizAnswers = Array.isArray(st.answers) ? st.answers : [];
    currentRound = st.round ?? 0;
    const select = $("#practice-group-select");
    if (select) select.value = String(practiceGroup);
    $("#practice-start").classList.add("hidden");
    $("#practice-done").classList.add("hidden");
    $("#practice-quiz").classList.remove("hidden");
    showQuizQuestion();
    return true;
  }

  async function showQuizQuestion() {
    if (quizAdvanceTimer) {
      clearTimeout(quizAdvanceTimer);
      quizAdvanceTimer = null;
    }
    quizAnswered = false;
    const item = quizItems[quizIndex];
    const prev = quizAnswers[quizIndex];

    let options;
    if (prev && Array.isArray(prev.options)) {
      options = prev.options;
    } else {
      const pool = wordsInGroup(practiceGroup).filter((p) => p.word !== item.word);
      options = shuffle([item.zh, ...shuffle(pool).slice(0, 3).map((p) => p.zh)]);
    }

    const roundLabel = currentRound === 0 ? "第1轮" : "第2轮";
    $("#quiz-index").textContent = `${quizIndex + 1} / ${quizItems.length} · ${groupLabel(practiceGroup)}${roundLabel}`;
    $("#quiz-score").textContent = `得分 ${quizScore}`;
    $("#quiz-word").textContent = item.word;
    $("#quiz-feedback").classList.add("hidden");
    $("#quiz-next").classList.add("hidden");

    displayPhonetic($("#quiz-phonetic"), item.word, item);
    if (!prev) speakWord(item.word);

    const optsEl = $("#quiz-options");
    optsEl.innerHTML = "";
    options.forEach((zh) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.textContent = zh;
      btn.addEventListener("click", () => onQuizAnswer(btn, item, zh, options));
      optsEl.appendChild(btn);
    });

    if (prev) {
      quizAnswered = true;
      const correctZh = item.zh;
      $$(".quiz-option", optsEl).forEach((b) => {
        b.disabled = true;
        if (b.textContent === correctZh) b.classList.add("is-correct");
        if (b.textContent === prev.selected && !prev.correct) b.classList.add("is-wrong");
      });
      const fb = $("#quiz-feedback");
      fb.classList.remove("hidden");
      if (prev.correct) {
        fb.textContent = "回答正确！";
        fb.className = "msg msg--success";
      } else {
        fb.textContent = `答错了，正确：${correctZh}`;
        fb.className = "msg msg--error";
      }
      $("#quiz-next").classList.remove("hidden");
    }

    $("#quiz-prev").classList.toggle("hidden", quizIndex === 0);
  }

  function onQuizAnswer(btn, item, chosen, options) {
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

    quizAnswers[quizIndex] = { selected: chosen, correct: isRight, options };
    saveQuizState();

    if (quizAdvanceTimer) clearTimeout(quizAdvanceTimer);
    quizAdvanceTimer = setTimeout(() => goNextQuiz(), isRight ? 500 : 2000);
  }

  function goPrevQuiz() {
    if (quizIndex <= 0) return;
    quizIndex--;
    saveQuizState();
    showQuizQuestion();
  }

  function goNextQuiz() {
    quizIndex++;
    if (quizIndex >= quizItems.length) {
      // 标记当前轮已完成
      const split = getPracticeSplit(practiceGroup);
      if (split) {
        if (currentRound === 0) split.round0Done = true;
        else split.round1Done = true;
        savePracticeSplit(practiceGroup, split);
      }
      $("#practice-quiz").classList.add("hidden");
      $("#practice-done").classList.remove("hidden");
      const tip = END_TIPS[Math.floor(Math.random() * END_TIPS.length)];
      const roundText = currentRound === 0 ? "第1轮" : "第2轮";
      $("#practice-summary").textContent = `${groupLabel(practiceGroup)}${roundText}：共 ${quizItems.length} 题，答对 ${quizScore} 题。\n\n${tip}`;
      clearQuizState();
    } else {
      saveQuizState();
      showQuizQuestion();
    }
  }

  $("#quiz-speak").addEventListener("click", () => speakWord(quizItems[quizIndex]?.word));
  $("#quiz-next").addEventListener("click", () => {
    if (quizAdvanceTimer) {
      clearTimeout(quizAdvanceTimer);
      quizAdvanceTimer = null;
    }
    goNextQuiz();
  });
  $("#quiz-prev").addEventListener("click", () => {
    if (quizAdvanceTimer) {
      clearTimeout(quizAdvanceTimer);
      quizAdvanceTimer = null;
    }
    goPrevQuiz();
  });

  function onEnterPractice() {
    updatePracticeHint();
    const quizVisible = !$("#practice-quiz").classList.contains("hidden");
    if (quizVisible) return;
    if (!restoreQuiz()) {
      $("#practice-quiz").classList.add("hidden");
      $("#practice-done").classList.add("hidden");
      $("#practice-start").classList.remove("hidden");
    }
  }

  $("#practice-begin").addEventListener("click", startPractice);
  $("#practice-restart").addEventListener("click", () => {
    $("#practice-done").classList.add("hidden");
    $("#practice-start").classList.remove("hidden");
    updatePracticeHint();
  });

  // 练习中途返回：保存进度，回到选择界面
  $("#quiz-exit").addEventListener("click", () => {
    if (quizAdvanceTimer) {
      clearTimeout(quizAdvanceTimer);
      quizAdvanceTimer = null;
    }
    saveQuizState();
    $("#practice-quiz").classList.add("hidden");
    $("#practice-start").classList.remove("hidden");
    updatePracticeHint();
  });

  // 重新洗牌：清除当前组的 split 和 quiz 状态，下次重新出题
  $("#practice-reshuffle").addEventListener("click", () => {
    const g = parseInt($("#practice-group-select")?.value ?? getGroup(), 10);
    localStorage.removeItem(KEYS.practiceSplit + "_" + g);
    clearQuizState();
    updatePracticeHint();
  });

  bindGroupSelect("practice-group-select", updatePracticeHint);
  bindGroupSelect("fav-group-select", renderFavorites);
  bindGroupSelect("wrong-group-select", renderWrong);

  /* ── AI Chat ── */
  function appendChatBubble(text, role, opts = {}) {
    const div = document.createElement("div");
    div.className = `chat-bubble chat-bubble--${role} glass`;
    const p = document.createElement("p");
    p.textContent = text;
    div.appendChild(p);
    $("#chat-messages").appendChild(div);
    if (!opts.noScroll) div.scrollIntoView({ behavior: "smooth", block: "end" });
    return div;
  }

  function loadChatHistory() {
    const hist = load(KEYS.chat, []);
    if (!Array.isArray(hist) || !hist.length) return [];
    hist.forEach((m) => {
      appendChatBubble(m.content, m.role === "user" ? "user" : "ai", { noScroll: true });
    });
    return hist;
  }

  function saveChatHistory(history) {
    save(KEYS.chat, history.slice(-50));
  }

  async function callAiApi(userMessage, history) {
    // 优先后端 /api/chat
    try {
      const messages = [
        { role: "system", content: "You are English Daily AI, a friendly CET-4 English tutor." },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userMessage },
      ];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, messages }),
      });
      if (res.ok) {
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) return reply;
      }
    } catch {
      /* 回退到 config.js */
    }

    const cfg = window.AI_CONFIG || { endpoint: "", apiKey: "", model: "gpt-4o-mini" };
    if (!cfg.endpoint || !cfg.apiKey) {
      throw new Error("AI 未配置：后端 /api/chat 不可用，且 config.js 未填写 endpoint/apiKey。");
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
          { role: "system", content: "You are English Daily AI, a friendly CET-4 English tutor." },
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

  const chatHistory = loadChatHistory();
  // 进入时滚动到最新消息
  const msgContainer = $("#chat-messages");
  if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;

  function sendChatMessage() {
    const text = $("#chat-input").value.trim();
    if (!text) return;
    $("#chat-input").value = "";
    appendChatBubble(text, "user");
    chatHistory.push({ role: "user", content: text });
    saveChatHistory(chatHistory);
    const loading = appendChatBubble("思考中…", "ai");
    (async () => {
      try {
        const reply = await callAiApi(text, chatHistory.slice(0, -1));
        loading.remove();
        appendChatBubble(reply, "ai");
        chatHistory.push({ role: "assistant", content: reply });
        saveChatHistory(chatHistory);
      } catch (err) {
        loading.remove();
        appendChatBubble(err.message || "失败", "error");
      }
    })();
  }

  $("#chat-send").addEventListener("click", sendChatMessage);
  $("#chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  $("#chat-clear").addEventListener("click", () => {
    if (!confirm("确定要清空所有聊天记录吗？")) return;
    chatHistory.length = 0;
    save(KEYS.chat, []);
    $("#chat-messages").innerHTML = `
      <div class="chat-bubble chat-bubble--ai glass">
        <p>你好！我是 English Daily AI，一起练习英语吧。</p>
      </div>`;
  });

  /* ── Init ── */
  $("#home-total-words").textContent = String(META.totalWords || CET4_LIST.length);
  $("#home-total-groups").textContent = String(META.totalGroups);
  resetMemDeck();
  syncGroupSelects();
  showView("home");
})();
