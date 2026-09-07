/**
 * Registry for task-answer strategies. A strategy owns validating task data,
 * rendering its controls, normalising a submitted answer and evaluating it.
 * Registering a new strategy leaves ui.js unchanged.
 */
const strategies = new Map();

export const registerAnswerType = (name, strategy) => {
  for (const method of ["render", "readAnswer", "evaluate"]) {
    if (typeof strategy?.[method] !== "function") {
      throw new TypeError(`Antworttyp ${name} benötigt die Methode ${method}().`);
    }
  }
  strategies.set(name, Object.freeze({ ...strategy }));
};

export const getAnswerTypeStrategy = (name) => strategies.get(name) ?? null;

const getCorrectOptionIds = (solution) => {
  if (!solution || typeof solution !== "object") return [];
  const value = solution.richtigeAntwort ?? solution.richtigeAntworten;
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value : [];
};

const validateOptions = (task) => {
  if (!Array.isArray(task.antwortmöglichkeiten) || task.antwortmöglichkeiten.length === 0) {
    throw new Error(`Auswahlaufgabe ${task.id} benötigt Antwortmöglichkeiten.`);
  }
  const ids = task.antwortmöglichkeiten.map((option) => option?.id);
  if (task.antwortmöglichkeiten.some((option) => !option?.id || !option?.text) || new Set(ids).size !== ids.length) {
    throw new Error(`Auswahlaufgabe ${task.id} benötigt eindeutige Antwort-IDs und sichtbare Texte.`);
  }
  return new Set(ids);
};

const validateSolutionIds = (task, correctIds, expectedCount = null) => {
  const optionIds = validateOptions(task);
  if (!correctIds.length || (expectedCount !== null && correctIds.length !== expectedCount)) {
    throw new Error(`Auswahlaufgabe ${task.id} besitzt keine gültige Lösung.`);
  }
  if (new Set(correctIds).size !== correctIds.length || correctIds.some((id) => !optionIds.has(id))) {
    throw new Error(`Die Lösung von Aufgabe ${task.id} referenziert ungültige Antwort-IDs.`);
  }
};

const renderOptions = (task, inputType, { escapeHtml }) => task.antwortmöglichkeiten.map((option) =>
  `<label class="answer-option"><input type="${inputType}" name="answer" value="${escapeHtml(option.id)}" /> <span>${escapeHtml(option.text)}</span></label>`
).join("");

const validateMatchingTask = (task) => {
  if (!Array.isArray(task.zuordnungen) || task.zuordnungen.length === 0) {
    throw new Error(`Zuordnungsaufgabe ${task.id} benötigt Zuordnungen.`);
  }
  const optionIds = validateOptions(task);
  const rowIds = task.zuordnungen.map((row) => row?.id);
  if (task.zuordnungen.some((row) => !row?.id || !row?.text || !optionIds.has(row.richtigeAntwort)
      || (row.antwortIds && (!Array.isArray(row.antwortIds) || !row.antwortIds.includes(row.richtigeAntwort)
        || row.antwortIds.some((id) => !optionIds.has(id)))))
    || new Set(rowIds).size !== rowIds.length) {
    throw new Error(`Zuordnungsaufgabe ${task.id} besitzt ungültige Zeilen oder Lösungen.`);
  }
};

registerAnswerType("freitext", {
  validateTask() {},
  render(task, { escapeHtml }) {
    return `<label class="answer-field" for="answer-${escapeHtml(task.id)}">Deine Antwort</label>
      <textarea id="answer-${escapeHtml(task.id)}" name="answer" rows="6" required></textarea>`;
  },
  readAnswer(form) {
    const answer = form.elements.answer?.value.trim();
    return answer || null;
  },
  // An expectation horizon is deliberately not machine-graded.
  evaluate() {
    return null;
  }
});

registerAnswerType("single-choice", {
  validateTask(task) {
    const correctIds = getCorrectOptionIds(task.lösung);
    if (typeof task.lösung?.richtigeAntwort !== "string" || "richtigeAntworten" in task.lösung) {
      throw new Error(`Einzelwahl-Aufgabe ${task.id} benötigt genau eine richtigeAntwort.`);
    }
    validateSolutionIds(task, correctIds, 1);
  },
  render(task, { escapeHtml }) {
    return renderOptions(task, "radio", { escapeHtml });
  },
  readAnswer(form) {
    return form.querySelector("input[name='answer']:checked")?.value ?? null;
  },
  evaluate(task, answer) {
    return answer === task.lösung.richtigeAntwort;
  }
});

registerAnswerType("multiple-choice", {
  validateTask(task) {
    if (!Array.isArray(task.lösung?.richtigeAntworten) || "richtigeAntwort" in task.lösung) {
      throw new Error(`Mehrfachwahl-Aufgabe ${task.id} benötigt richtigeAntworten als Liste.`);
    }
    validateSolutionIds(task, task.lösung.richtigeAntworten);
  },
  render(task, { escapeHtml }) {
    return renderOptions(task, "checkbox", { escapeHtml });
  },
  readAnswer(form) {
    const selected = Array.from(form.querySelectorAll("input[name='answer']:checked"), (input) => input.value);
    return selected.length ? selected : null;
  },
  evaluate(task, answer) {
    if (!Array.isArray(answer)) return false;
    const selected = new Set(answer);
    const correct = new Set(task.lösung.richtigeAntworten);
    return selected.size === answer.length
      && selected.size === correct.size
      && [...correct].every((id) => selected.has(id));
  }
});

registerAnswerType("zuordnung", {
  validateTask: validateMatchingTask,
  render(task, { escapeHtml }) {
    return task.zuordnungen.map((row) => {
      const allowedIds = row.antwortIds ? new Set(row.antwortIds) : null;
      const options = task.antwortmöglichkeiten
        .filter((option) => !allowedIds || allowedIds.has(option.id))
        .map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.text)}</option>`)
        .join("");
      return `
      <label class="matching-row">
        <span>${escapeHtml(row.text)}</span>
        <select name="answer-${escapeHtml(row.id)}" required>
          <option value="">Bitte zuordnen</option>${options}
        </select>
      </label>`;
    }).join("");
  },
  readAnswer(form) {
    const selects = Array.from(form.querySelectorAll("select[name^='answer-']"));
    if (!selects.length || selects.some((select) => !select.value)) return null;
    return Object.fromEntries(selects.map((select) => [select.name.slice(7), select.value]));
  },
  evaluate(task, answer) {
    return Boolean(answer) && task.zuordnungen.every((row) => answer[row.id] === row.richtigeAntwort);
  }
});

registerAnswerType("zahl", {
  validateTask(task) {
    if (typeof task.lösung?.richtigerWert !== "number" || !Number.isFinite(task.lösung.richtigerWert)) {
      throw new Error(`Zahlenaufgabe ${task.id} benötigt einen richtigenWert.`);
    }
  },
  render(task, { escapeHtml }) {
    return `<label class="answer-field" for="number-answer">Widerstand in Ω</label>
      <input class="number-answer" id="number-answer" name="answer" type="number" step="any" inputmode="decimal" required />`;
  },
  readAnswer(form) {
    const raw = form.elements.answer?.value.trim().replace(",", ".");
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  },
  evaluate(task, answer) {
    return typeof answer === "number" && Number.isFinite(answer)
      && Math.abs(answer - task.lösung.richtigerWert) <= (task.lösung.toleranz ?? 0);
  }
});
