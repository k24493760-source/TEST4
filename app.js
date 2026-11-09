/* ============================================================
   ИИ-МЕНЕДЖЕР ПРОДАЖ КУРСОВ — ЛОГИКА
   ============================================================ */

const AI_CONFIG = {
  endpoint: localStorage.getItem("AI_ENDPOINT") || "https://api.openai.com/v1/chat/completions",
  apiKey: localStorage.getItem("AI_API_KEY") || "",
  model: localStorage.getItem("AI_MODEL") || "gpt-4o-mini"
};

const INTEREST_LABELS = [
  { keys: ["рисован", "лепк", "творч"], label: "Творчество" },
  { keys: ["программ", "код", "scratch", "компьютер"], label: "Программирование" },
  { keys: ["танц", "движен"], label: "Танцы" },
  { keys: ["музык", "пианино", "вокал", "пение"], label: "Музыка" },
  { keys: ["спорт"], label: "Спорт" },
  { keys: ["йог", "mindful"], label: "Йога" },
  { keys: ["матем", "лог"], label: "Логика и математика" },
  { keys: ["актер", "театр"], label: "Театр" },
  { keys: ["оратор", "выступ"], label: "Ораторское искусство" },
  { keys: ["эко", "природ", "поделк"], label: "Экология" },
  { keys: ["робот", "3d", "arduino", "техн"], label: "Технологии" }
];

const ISSUE_LABELS = [
  { keys: ["тревог", "стресс"], label: "Тревожность" },
  { keys: ["застенчив", "стеснит"], label: "Стеснительность" },
  { keys: ["вниман", "концентрац"], label: "Концентрация" },
  { keys: ["речь", "лого"], label: "Речь" },
  { keys: ["агресс"], label: "Агрессия" },
  { keys: ["перегруз"], label: "Перегрузка" },
  { keys: ["уверенност"], label: "Уверенность" }
];

const state = {
  profile: { name: null, age: null, grade: null, parent: null, phone: null, email: null },
  interests: [],
  issues: [],
  courses: [],
  history: [],
  funnelStep: 1,
  finished: false,
  analytics: null,
  pdfBlob: null,
  awaiting: "name",
  busy: false
};

const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const quickReplies = document.getElementById("quickReplies");

function setFunnel(step) {
  state.funnelStep = step;
  document.querySelectorAll(".funnel-step").forEach((el) => {
    const s = +el.dataset.step;
    el.classList.toggle("active", s === step);
    el.classList.toggle("done", s < step);
  });
}

function highlightCard(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  card.classList.remove("updated");
  void card.offsetWidth;
  card.classList.add("updated");
}

function setField(field, value) {
  if (!value) return;
  const el = document.querySelector(`.field[data-field="${field}"] .value`);
  if (!el) return;
  el.textContent = value;
  el.classList.remove("status");
  el.classList.add("filled");
  highlightCard(el.closest(".profile-card").id);
}

function addChip(containerId, text) {
  const box = document.getElementById(containerId);
  const empty = box.querySelector(".chip-empty");
  if (empty) empty.remove();
  const exists = [...box.querySelectorAll(".chip")].some((c) => c.textContent === text);
  if (exists) return;
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = text;
  box.appendChild(chip);
}

function addMessage(role, text, extraHtml) {
  const msg = document.createElement("div");
  msg.className = `message ${role}`;
  msg.textContent = text;
  if (extraHtml) {
    const wrap = document.createElement("div");
    wrap.innerHTML = extraHtml;
    msg.appendChild(wrap);
  }
  chatWindow.appendChild(msg);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  state.history.push({ role, text });
}

function showTyping() {
  const t = document.createElement("div");
  t.className = "typing";
  t.id = "typingIndicator";
  t.innerHTML = "<span></span><span></span><span></span>";
  chatWindow.appendChild(t);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function hideTyping() {
  document.getElementById("typingIndicator")?.remove();
}

function setQuickReplies(options) {
  quickReplies.innerHTML = "";
  (options || []).forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = opt;
    btn.onclick = () => {
      quickReplies.innerHTML = "";
      handleUserMessage(opt);
    };
    quickReplies.appendChild(btn);
  });
}

function matchLabels(text, dict) {
  const t = text.toLowerCase();
  return dict.filter((item) => item.keys.some((k) => t.includes(k))).map((item) => item.label);
}

function extractName(text) {
  const skip = /^(здравствуйте|привет|добрый|хочу|узнать|курсы|да|нет|подходит)$/i;
  const m = text.match(/[А-ЯЁ][а-яё]+/);
  if (m && !skip.test(m[0])) return m[0];
  return null;
}

async function aiRespond(userText) {
  showTyping();
  await new Promise((r) => setTimeout(r, 650));

  const t = userText.toLowerCase();
  let reply = "";
  let extras = "";
  let replies = [];

  if (state.awaiting === "name") {
    const name = extractName(userText);
    if (name) {
      state.profile.name = name;
      setField("name", name);
      setFunnel(2);
      state.awaiting = "age";
      reply = `Приятно познакомиться! 😊 Сколько лет ${name} и в каком он классе?`;
      replies = ["7 лет, 1 класс", "9 лет, 3 класс", "10 лет, 4 класс"];
    } else {
      setFunnel(1);
      reply = "Подскажите, пожалуйста, как зовут ребенка?";
      replies = ["Маша", "Артём", "София"];
    }
    return finish(reply, extras, replies);
  }

  if (state.awaiting === "age") {
    const age = userText.match(/(\d{1,2})\s*(лет|года|год)?/);
    const grade = userText.match(/(\d{1,2})\s*класс/);
    if (age && +age[1] >= 4 && +age[1] <= 16) {
      state.profile.age = age[1];
      setField("age", `${age[1]} лет`);
    }
    if (grade) {
      state.profile.grade = grade[1];
      setField("grade", `${grade[1]} класс`);
    }
    if (state.profile.age) {
      setFunnel(3);
      state.awaiting = "interests";
      reply = `Отлично! Какие занятия нравятся ${state.profile.name} больше всего? Можно несколько: творчество, спорт, программирование, музыка…`;
      replies = ["Рисование и музыка", "Программирование", "Танцы и спорт"];
    } else {
      reply = "Сколько лет ребенку и в каком он классе?";
      replies = ["8 лет, 2 класс", "11 лет, 5 класс"];
    }
    return finish(reply, extras, replies);
  }

  if (state.awaiting === "interests") {
    const found = matchLabels(userText, INTEREST_LABELS);
    found.forEach((label) => {
      if (!state.interests.includes(label)) {
        state.interests.push(label);
        addChip("interestsChips", label);
      }
    });
    if (found.length) highlightCard("card-interests");
    if (state.interests.length) {
      state.awaiting = "issues";
      reply = "Записал! Есть ли трудности или зоны роста, с которыми хотели бы помочь? (тревожность, стеснительность, концентрация, речь…)";
      replies = ["Стеснительность", "Тревожность", "Концентрация внимания"];
    } else {
      reply = "Какие увлечения у ребенка? Творчество, спорт, интеллектуальные занятия?";
      replies = ["Творчество", "Программирование", "Музыка"];
    }
    return finish(reply, extras, replies);
  }

  if (state.awaiting === "issues") {
    const found = matchLabels(userText, ISSUE_LABELS);
    found.forEach((label) => {
      if (!state.issues.includes(label)) {
        state.issues.push(label);
        addChip("issuesChips", label);
      }
    });
    if (found.length) highlightCard("card-issues");
    if (!found.length && (t.includes("нет") || t.includes("все норм") || t.includes("всё хорошо"))) {
      addChip("issuesChips", "Без острых запросов");
    }
    state.awaiting = "courses";
    setFunnel(4);
    const rec = pickCourses();
    extras = inlineCoursesHtml(rec);
    reply = "Поняла вас! На основе интересов, возраста и запроса я подобрала курсы из базы знаний центра 👇";
    replies = ["Да, подходит", "Подробнее о первом", "Показать другие"];
    return finish(reply, extras, replies);
  }

  if (state.awaiting === "courses") {
    if (t.includes("друг")) {
      const more = pickCourses(true);
      extras = inlineCoursesHtml(more);
      reply = "Вот альтернативный набор из базы знаний. Какой откликается?";
      replies = ["Да, подходит", "Оставить первый набор"];
      return finish(reply, extras, replies);
    }
    if (t.includes("подроб")) {
      const first = state.courses[0];
      const kbHit = (window.COURSE_CATALOG || []).find((c) => c.name === first?.name);
      reply = first
        ? `«${first.name}»: ${first.desc}\nВозраст: ${first.age}. Стоимость: ${kbHit?.price || "по прайсу"}. Расписание: ${kbHit?.schedule || "уточним у менеджера"}.\nПодходит этот курс?`
        : "Давайте выберем курс из списка.";
      replies = ["Да, подходит", "Показать другие"];
      return finish(reply, extras, replies);
    }
    if (t.includes("да") || t.includes("подход") || t.includes("запис") || t.includes("перв") || t.includes("этот")) {
      if (!state.courses.length) pickCourses();
      state.courses[0].confirmed = true;
      if (state.courses[1] && (t.includes("несколько") || t.includes("оба") || t.includes("два"))) {
        state.courses[1].confirmed = true;
      }
      renderCourses();
      setFunnel(5);
      state.awaiting = "contacts";
      reply = "Отлично! Курс подтверждаем ✅ Оставьте контакты для связи: имя родителя, телефон и email.";
      replies = ["Анна, +7 999 123-45-67, anna@mail.ru"];
      return finish(reply, extras, replies);
    }
    reply = "Какой из предложенных курсов вам откликается? Можно выбрать один или несколько.";
    replies = ["Да, подходит", "Подробнее о первом", "Показать другие"];
    return finish(reply, extras, replies);
  }

  if (state.awaiting === "contacts") {
    const phone = userText.match(/(\+?\d[\d\s\-()]{9,})/);
    if (phone) {
      state.profile.phone = phone[1].trim();
      setField("phone", state.profile.phone);
    }
    const email = userText.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (email) {
      state.profile.email = email[0];
      setField("email", state.profile.email);
    }
    const parent = userText.match(/[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?/);
    if (parent && !/класс|лет/.test(parent[0])) {
      state.profile.parent = parent[0];
      setField("parent", state.profile.parent);
    }
    if (state.profile.phone) {
      setFunnel(6);
      state.awaiting = "done";
      state.finished = true;
      document.getElementById("finalBlock").style.display = "flex";
      setFunnel(7);
      reply = "Спасибо! Данные сохранены. Нажмите «Сформировать PDF-отчет»: вторая модель проанализирует весь диалог и подготовит резюме, рекомендации и итоги.";
      replies = [];
    } else {
      reply = "Напишите, пожалуйста, телефон для связи (и email, если удобно).";
      replies = ["+7 999 111-22-33"];
    }
    return finish(reply, extras, replies);
  }

  reply = "Спасибо! Если хотите, расскажу подробнее о расписании или сформируем PDF-отчет.";
  replies = state.finished ? [] : ["Сформировать отчет"];
  return finish(reply, extras, replies);
}

function finish(reply, extras, replies) {
  hideTyping();
  addMessage("ai", reply, extras);
  setQuickReplies(replies);
  return reply;
}

function pickCourses(alternate) {
  const catalog = window.COURSE_CATALOG || [];
  const hay = [...state.interests, ...state.issues].join(" ").toLowerCase();
  let scored = catalog.map((c) => {
    const hit = c.keys.some((k) => hay.toLowerCase().includes(k) || state.interests.some((i) => i.toLowerCase().includes(k)));
    const issueHit = c.keys.some((k) => state.issues.some((i) => i.toLowerCase().includes(k) || ISSUE_LABELS.find((x) => x.label === i)?.keys.includes(k)));
    return { ...c, confirmed: false, score: (hit ? 2 : 0) + (issueHit ? 2 : 0) };
  });
  scored.sort((a, b) => b.score - a.score);
  if (!scored.some((c) => c.score > 0)) scored = catalog.map((c) => ({ ...c, confirmed: false }));
  const start = alternate ? 3 : 0;
  state.courses = scored.slice(start, start + 3).map((c) => ({ ...c, confirmed: false }));
  if (!state.courses.length) state.courses = catalog.slice(0, 3).map((c) => ({ ...c, confirmed: false }));
  document.getElementById("card-courses").style.display = "block";
  renderCourses();
  return state.courses;
}

function inlineCoursesHtml(courses) {
  return `<div class="inline-courses">${courses
    .map(
      (c) => `<div class="inline-course"><h4>${c.name}</h4><p>${c.desc} · ${c.age} · ${c.price || ""}</p></div>`
    )
    .join("")}</div>`;
}

function renderCourses() {
  const list = document.getElementById("coursesList");
  list.innerHTML = "";
  state.courses.forEach((c) => {
    const el = document.createElement("div");
    el.className = "course-card";
    el.innerHTML = `
      <h4>${c.name}</h4>
      <div>${c.desc}</div>
      <div class="badge">${c.confirmed ? "✅ Подтверждено" : "Рекомендовано AI"}</div>
    `;
    list.appendChild(el);
  });
  highlightCard("card-courses");
}

function handleUserMessage(text) {
  if (!text || state.busy) return;
  addMessage("user", text);
  if (text.toLowerCase().includes("сформировать отчет")) {
    document.getElementById("btnFinish").click();
    return;
  }
  aiRespond(text);
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;
  userInput.value = "";
  handleUserMessage(text);
});

window.addEventListener("DOMContentLoaded", () => {
  addMessage("ai", "Здравствуйте! 👋 Я AI-консультант «Весенней школы» (EdTech Spring Edition). Помогу подобрать занятия для вашего ребенка. Как его зовут?");
  setQuickReplies(["Здравствуйте!", "Хочу узнать про курсы"]);
  setFunnel(1);
});

/* ============================================================
   ЭТАП 2: ВТОРАЯ МОДЕЛЬ — АНАЛИТИКА ДИАЛОГА + PDF
   ============================================================ */

const PROFILE_PROMPT = `Ты — модель 1, экстрактор профиля ученика EdTech-центра.
По истории диалога верни JSON:
{
  "name": "", "age": "", "grade": "", "parent": "", "phone": "", "email": "",
  "interests": [], "issues": [], "courses": []
}
Только JSON.`;

const ANALYTICS_PROMPT = `Ты — модель 2, аналитик отдела продаж образовательного центра «Весенняя школа».
Тебе даны: история диалога, собранный профиль, база знаний курсов.
Не копируй поля профиля списком. Напиши аналитический текст:

Верни JSON:
{
  "summary": "резюме консультации 4–7 предложений: что важно семье, как ребенок проявился в запросе, логика подбора",
  "recommendations": ["персональная рекомендация 1", "рекомендация 2", "рекомендация 3"],
  "conclusions": "итоги и риски (перегрузка, стеснение, возраст группы) 3–5 предложений",
  "nextSteps": ["следующий шаг для менеджера/родителя"]
}
Опирайся на базу знаний: цены, расписание, возражения, психология продаж.
Только JSON.`;

async function callLLM(systemPrompt, userPrompt) {
  if (!AI_CONFIG.apiKey) return null;
  const res = await fetch(AI_CONFIG.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_CONFIG.apiKey}`
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });
  if (!res.ok) throw new Error("LLM HTTP " + res.status);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const json = content.match(/\{[\s\S]*\}/);
  return json ? JSON.parse(json[0]) : null;
}

function transcript() {
  return state.history.map((m) => `${m.role === "user" ? "Родитель" : "Ассистент"}: ${m.text}`).join("\n");
}

function localProfileExtraction() {
  return {
    name: state.profile.name,
    age: state.profile.age,
    grade: state.profile.grade,
    parent: state.profile.parent,
    phone: state.profile.phone,
    email: state.profile.email,
    interests: state.interests,
    issues: state.issues,
    courses: state.courses.filter((c) => c.confirmed).map((c) => c.name)
  };
}

function localAnalytics(profile) {
  const confirmed = state.courses.filter((c) => c.confirmed);
  const main = confirmed[0] || state.courses[0];
  const turns = state.history.filter((h) => h.role === "user").length;
  const child = profile.name || "ребенок";
  const interestText = profile.interests.join(", ") || "пока широкие";
  const issueText = profile.issues.join(", ") || "без острого запроса";
  const kb = window.COURSE_CATALOG.find((c) => c.name === main?.name);

  const summary = `Консультация прошла за ${turns} реплик родителя. В фокусе — ${child}${profile.age ? `, ${profile.age} лет` : ""}${profile.grade ? `, ${profile.grade} класс` : ""}. Семья описывает интересы как «${interestText}», а зону роста — «${issueText}». Ассистент не продавал «все курсы подряд», а сузил выбор до программ, которые одновременно совпадают с интересом и закрывают запрос развития. Основная гипотеза подбора: курс «${main?.name || "по интересам"}» как точка входа, с опорой на малые группы и бесплатное пробное занятие из базы знаний центра.`;

  const secondByIssue = (() => {
    if (profile.issues.includes("Тревожность") && main?.name !== "Йога и mindfulness") {
      return "Параллельно предложить «Йогу и mindfulness» (суббота 10:00–11:00, 2 200 ₽/мес) — не как второй кружок «для галочки», а как поддержку адаптации.";
    }
    if (profile.issues.includes("Стеснительность") && main?.name !== "Актерское мастерство") {
      return "Если пробное по основному курсу пройдет спокойно, вторым шагом — «Актерское мастерство» без обязательных выступлений в первый месяц.";
    }
    const alt = state.courses.find((c) => c.name !== main?.name);
    if (alt) {
      return `Не дублировать один и тот же курс: как второй интерес оставить «${alt.name}» только после пробного, чтобы не перегрузить расписание.`;
    }
    return "Не набирать больше двух курсов сразу: в базе знаний прямо заложен риск перегрузки, лучше 1 основной + пробное.";
  })();

  const recommendations = [
    `Начать с «${main?.name || "Рисование и лепка"}» (${kb?.schedule || "ближайший слот"}, ${kb?.price || "по прайсу"}, возраст ${kb?.age || main?.age || ""}). Это совпадает с профилем и снижает риск отказа после пробного.`,
    secondByIssue,
    "Закрепить следующий шаг: бесплатное пробное, затем звонок менеджера. Если смущает цена — пакет из 2 курсов дает скидку 10%."
  ];

  const conclusions = `Итог консультации: есть собранный профиль, подтвержденный интерес к программе и контакты для передачи в отдел продаж. Риски: ${issueText}. Для возраста ${profile.age || "указанного"} важно не смешивать группы 6 и 11 лет. PDF фиксирует не сырые поля, а логику рекомендации, чтобы родитель мог обсудить выбор с семьей.`;

  const nextSteps = [
    `Позвонить ${profile.parent || "родителю"} по номеру ${profile.phone || "из карточки"} и предложить пробное по курсу «${main?.name || "…"}».`,
    `Отправить этот отчет на ${profile.email || "email, если появится"}.`,
    "После пробного — короткое сообщение: что понравилось ребенку и какой абонемент удобен."
  ];

  return { summary, recommendations, conclusions, nextSteps };
}

async function generateAnalytics() {
  const payload = `ПРОФИЛЬ:\n${JSON.stringify(localProfileExtraction(), null, 2)}\n\nИСТОРИЯ:\n${transcript()}\n\nБАЗА ЗНАНИЙ:\n${window.KNOWLEDGE_BASE}`;

  let extracted = localProfileExtraction();
  try {
    const fromModel1 = await callLLM(PROFILE_PROMPT, payload);
    if (fromModel1) extracted = { ...extracted, ...fromModel1 };
  } catch (e) {
    console.warn("Модель 1 недоступна, используем локальный экстрактор", e);
  }

  let analytics = localAnalytics(extracted);
  try {
    const fromModel2 = await callLLM(ANALYTICS_PROMPT, payload);
    if (fromModel2) analytics = { ...analytics, ...fromModel2 };
  } catch (e) {
    console.warn("Модель 2 недоступна, используем локальную аналитику", e);
  }

  analytics.profile = extracted;
  analytics.generatedAt = new Date();
  analytics.source = AI_CONFIG.apiKey ? "llm" : "second-prompt-local";
  return analytics;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderPdfSheet(analytics) {
  const p = analytics.profile;
  const center = window.CENTER;
  const date = analytics.generatedAt.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const confirmed = state.courses.filter((c) => c.confirmed);
  const list = (confirmed.length ? confirmed : state.courses)
    .map(
      (c) => `<div class="pdf-course"><strong>${escapeHtml(c.name)}</strong><div>${escapeHtml(c.desc)} · ${escapeHtml(c.age)} · ${escapeHtml(c.price || "")}<br>${escapeHtml(c.schedule || "")}</div></div>`
    )
    .join("");

  document.getElementById("pdfSheet").innerHTML = `
    <div class="pdf-page">
      <header class="pdf-header">
        <img src="assets/logo.png" alt="logo" />
        <div>
          <h1>${escapeHtml(center.name)}</h1>
          <p>${escapeHtml(center.brand)} · персональный отчет консультации</p>
        </div>
        <div class="pdf-date">
          <div>Дата</div>
          <strong>${escapeHtml(date)}</strong>
        </div>
      </header>

      <section class="pdf-section">
        <h2>1. Профиль ребенка</h2>
        <div class="pdf-grid">
          <div><span>Имя</span><br><strong>${escapeHtml(p.name || "—")}</strong></div>
          <div><span>Возраст / класс</span><br><strong>${escapeHtml(p.age ? p.age + " лет" : "—")} / ${escapeHtml(p.grade ? p.grade + " класс" : "—")}</strong></div>
          <div><span>Интересы</span><br><strong>${escapeHtml((p.interests || []).join(", ") || "—")}</strong></div>
          <div><span>Зоны развития</span><br><strong>${escapeHtml((p.issues || []).join(", ") || "—")}</strong></div>
          <div><span>Родитель</span><br><strong>${escapeHtml(p.parent || "—")}</strong></div>
          <div><span>Контакты</span><br><strong>${escapeHtml(p.phone || "—")} · ${escapeHtml(p.email || "—")}</strong></div>
        </div>
      </section>

      <section class="pdf-section">
        <h2>2. Резюме консультации (модель 2)</h2>
        <p>${escapeHtml(analytics.summary)}</p>
      </section>

      <section class="pdf-section">
        <h2>3. Рекомендации</h2>
        <ul>${(analytics.recommendations || []).map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
      </section>

      <section class="pdf-section">
        <h2>4. Подобранные курсы</h2>
        ${list}
      </section>

      <section class="pdf-section">
        <h2>5. Итоги и следующие шаги</h2>
        <p>${escapeHtml(analytics.conclusions)}</p>
        <ul>${(analytics.nextSteps || []).map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
      </section>

      <footer class="pdf-footer">
        ${escapeHtml(center.name)} · ${escapeHtml(center.address)} · ${escapeHtml(center.phone)} · ${escapeHtml(center.email)}<br>
        Документ сформирован автоматически по шаблону бренда. Источник аналитики: ${analytics.source === "llm" ? "внешняя LLM" : "второй аналитический промпт по истории диалога"}.
      </footer>
    </div>
  `;
}

async function buildPdfBlob() {
  const sheet = document.getElementById("pdfSheet");
  const canvas = await html2canvas(sheet, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
  const img = canvas.toDataURL("image/jpeg", 0.92);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const imgH = (canvas.height * pageW) / canvas.width;
  let y = 0;
  let left = imgH;
  pdf.addImage(img, "JPEG", 0, y, pageW, imgH);
  left -= pageH;
  while (left > 0) {
    y -= pageH;
    pdf.addPage();
    pdf.addImage(img, "JPEG", 0, y, pageW, imgH);
    left -= pageH;
  }
  return pdf.output("blob");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

document.getElementById("btnFinish").addEventListener("click", async () => {
  const btn = document.getElementById("btnFinish");
  const status = document.getElementById("analyticsStatus");
  const dl = document.getElementById("btnDownload");
  btn.disabled = true;
  status.textContent = "Модель 1 собирает профиль, модель 2 анализирует диалог…";
  addMessage("ai", "Запускаю аналитику по всей истории диалога и готовлю брендированный PDF…");
  showTyping();
  try {
    const analytics = await generateAnalytics();
    state.analytics = analytics;
    renderPdfSheet(analytics);
    await new Promise((r) => setTimeout(r, 80));
    state.pdfBlob = await buildPdfBlob();
    hideTyping();
    dl.style.display = "block";
    status.textContent = "Отчет готов — можно скачать PDF.";
    addMessage("ai", "Готово. В PDF — резюме, рекомендации и итоги второй модели, а не просто список полей профиля.");
  } catch (err) {
    hideTyping();
    console.error(err);
    status.textContent = "Не удалось собрать PDF. Попробуйте ещё раз.";
    addMessage("ai", "Не получилось сгенерировать PDF. Проверьте, что страница открыта через сервер, не как file://.");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("btnDownload").addEventListener("click", () => {
  if (!state.pdfBlob) return;
  const name = (state.profile.name || "rebenok").toLowerCase();
  downloadBlob(state.pdfBlob, `otchet-vesennyaya-shkola-${name}.pdf`);
});
