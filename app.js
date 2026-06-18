const state = {
  counterType: "up",
  singleLimit: 13,
  upLimit: 7,
  downLimit: 5,
  ffType: "D",
  basisType: "and",
  stateTableFlipped: false,
};

const VAR_LIMIT = 6;

const counterTypeEl = document.getElementById("counterType");
const singleLimitWrapEl = document.getElementById("singleLimitWrap");
const singleLimitEl = document.getElementById("singleLimit");
const upLimitWrapEl = document.getElementById("upLimitWrap");
const upLimitEl = document.getElementById("upLimit");
const downLimitWrapEl = document.getElementById("downLimitWrap");
const downLimitEl = document.getElementById("downLimit");
const ffTypeEl = document.getElementById("ffType");
const basisTypeEl = document.getElementById("basisType");

const bitCountEl = document.getElementById("bitCount");
const stateCountEl = document.getElementById("stateCount");
const unusedCountEl = document.getElementById("unusedCount");

const stateAreaEl = document.getElementById("stateArea");
const mapsAreaEl = document.getElementById("mapsArea");
const finalAreaEl = document.getElementById("finalArea");
const stateOrderToggleEl = document.getElementById("stateOrderToggle");
const copyAllStatesEl = document.getElementById("copyAllStates");

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function bitCountForMax(maxValue) {
  return Math.max(1, Math.ceil(Math.log2(maxValue + 1)));
}

function padBits(value, width) {
  return value.toString(2).padStart(width, "0").split("").map(Number);
}

function bitsToValue(bits) {
  return parseInt(bits.join(""), 2);
}

function grayStrings(count) {
  if (count <= 0) return [""];
  if (count === 1) return ["0", "1"];
  const prev = grayStrings(count - 1);
  return prev.map((v) => `0${v}`).concat([...prev].reverse().map((v) => `1${v}`));
}

function qNames(count) {
  return Array.from({ length: count }, (_, i) => `Q${i + 1}`);
}

function mapVarNames(totalVars, reversible) {
  if (!reversible) return qNames(totalVars);
  if (totalVars === 4) return ["\u03b1", "Q0", "Q1", "Q2"];
  return ["\u03b1", ...Array.from({ length: totalVars - 1 }, (_, i) => `Q${i}`)];
}

function bitsText(bits) {
  return bits.join("");
}

function makeCell(tag, text) {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}

function sequenceValues(direction, limit) {
  const values = Array.from({ length: limit + 1 }, (_, i) => i);
  if (direction === "down") return values.reverse();
  if (direction === "downFromZero") return values;
  return values;
}

function scenarios() {
  if (state.counterType === "reversible") {
    return [
      { label: "Прямой ход", direction: "up", limit: state.upLimit },
      { label: "Обратный ход", direction: "downFromZero", limit: state.downLimit },
    ];
  }

  return [
    {
      label: state.counterType === "up" ? "Суммирующий" : "Вычитающий",
      direction: state.counterType,
      limit: state.singleLimit,
    },
  ];
}

function maxValueAcrossScenarios(list) {
  return Math.max(...list.map((item) => item.limit), 1);
}

function activeBitCount(list) {
  return Math.min(VAR_LIMIT, bitCountForMax(maxValueAcrossScenarios(list)));
}

function totalMapVars(bitCount) {
  return bitCount + (state.counterType === "reversible" ? 1 : 0);
}

function excitationForPair(currBit, nextBit) {
  if (state.ffType === "D") return { D: nextBit };
  if (state.ffType === "T") return { T: currBit ^ nextBit };
  if (state.ffType === "RS") {
    if (currBit === 0 && nextBit === 0) return { R: "X", S: 0 };
    if (currBit === 0 && nextBit === 1) return { R: 0, S: 1 };
    if (currBit === 1 && nextBit === 0) return { R: 1, S: 0 };
    return { R: 0, S: "X" };
  }
  if (currBit === 0 && nextBit === 0) return { J: 0, K: "X" };
  if (currBit === 0 && nextBit === 1) return { J: 1, K: "X" };
  if (currBit === 1 && nextBit === 0) return { J: "X", K: 1 };
  return { J: "X", K: 0 };
}

function buildRows(scenario, bitCount) {
  const ordered = sequenceValues(scenario.direction, scenario.limit);
  return ordered.map((value, idx) => {
    const next = ordered[(idx + 1) % ordered.length];
    const currentBits = padBits(value, bitCount);
    const nextBits = padBits(next, bitCount);
    const excitations = currentBits.map((bit, i) => excitationForPair(bit, nextBits[i]));
    return { index: idx + 1, value, next, currentBits, nextBits, excitations };
  });
}

function usedCodeSet(scenario, bitCount) {
  const set = new Set();
  sequenceValues(scenario.direction, scenario.limit).forEach((value) => {
    if (value < 2 ** bitCount) set.add(value);
  });
  return set;
}

function buildFunctionValues(scenario, bitCount) {
  const totalCodes = 2 ** bitCount;
  const functions = {};
  const used = usedCodeSet(scenario, bitCount);
  const ordered = sequenceValues(scenario.direction, scenario.limit);

  for (let bit = 0; bit < bitCount; bit++) {
    if (state.ffType === "D") functions[`D${bit + 1}`] = Array(totalCodes).fill("X");
    if (state.ffType === "T") functions[`T${bit + 1}`] = Array(totalCodes).fill("X");
    if (state.ffType === "JK") {
      functions[`J${bit + 1}`] = Array(totalCodes).fill("X");
      functions[`K${bit + 1}`] = Array(totalCodes).fill("X");
    }
    if (state.ffType === "RS") {
      functions[`R${bit + 1}`] = Array(totalCodes).fill("X");
      functions[`S${bit + 1}`] = Array(totalCodes).fill("X");
    }
  }

  ordered.forEach((value, idx) => {
    if (value >= totalCodes) return;
    const next = ordered[(idx + 1) % ordered.length];
    const currentBits = padBits(value, bitCount);
    const nextBits = padBits(next, bitCount);
    for (let bit = 0; bit < bitCount; bit++) {
      const pair = excitationForPair(currentBits[bit], nextBits[bit]);
      if (state.ffType === "D") functions[`D${bit + 1}`][value] = pair.D;
      if (state.ffType === "T") functions[`T${bit + 1}`][value] = pair.T;
      if (state.ffType === "JK") {
        functions[`J${bit + 1}`][value] = pair.J;
        functions[`K${bit + 1}`][value] = pair.K;
      }
      if (state.ffType === "RS") {
        functions[`R${bit + 1}`][value] = pair.R;
        functions[`S${bit + 1}`][value] = pair.S;
      }
    }
  });

  return { functions, used };
}

function buildCombinedFunctionValues(scenarioList, bitCount) {
  if (state.counterType !== "reversible") return buildFunctionValues(scenarioList[0], bitCount);

  const totalVars = bitCount + 1;
  const totalCodes = 2 ** totalVars;
  const functions = {};
  const used = new Set();

  for (let bit = 0; bit < bitCount; bit++) {
    if (state.ffType === "D") functions[`D${bit + 1}`] = Array(totalCodes).fill("X");
    if (state.ffType === "T") functions[`T${bit + 1}`] = Array(totalCodes).fill("X");
    if (state.ffType === "JK") {
      functions[`J${bit + 1}`] = Array(totalCodes).fill("X");
      functions[`K${bit + 1}`] = Array(totalCodes).fill("X");
    }
    if (state.ffType === "RS") {
      functions[`R${bit + 1}`] = Array(totalCodes).fill("X");
      functions[`S${bit + 1}`] = Array(totalCodes).fill("X");
    }
  }

  scenarioList.forEach((scenario, alpha) => {
    const ordered = sequenceValues(scenario.direction, scenario.limit);
    ordered.forEach((value, idx) => {
      if (value >= 2 ** bitCount) return;
      const next = ordered[(idx + 1) % ordered.length];
      const currentBits = padBits(value, bitCount);
      const nextBits = padBits(next, bitCount);
      const index = (alpha << bitCount) | value;
      used.add(index);

      for (let bit = 0; bit < bitCount; bit++) {
        const pair = excitationForPair(currentBits[bit], nextBits[bit]);
        if (state.ffType === "D") functions[`D${bit + 1}`][index] = pair.D;
        if (state.ffType === "T") functions[`T${bit + 1}`][index] = pair.T;
        if (state.ffType === "JK") {
          functions[`J${bit + 1}`][index] = pair.J;
          functions[`K${bit + 1}`][index] = pair.K;
        }
        if (state.ffType === "RS") {
          functions[`R${bit + 1}`][index] = pair.R;
          functions[`S${bit + 1}`][index] = pair.S;
        }
      }
    });
  });

  return { functions, used };
}

function collectImplicants(values, varCount, mode) {
  const targets = [];
  const dontCares = [];

  values.forEach((value, index) => {
    if (value === "X") dontCares.push(index);
    else if ((mode === "and" && String(value) === "1") || (mode === "or" && String(value) === "0")) {
      targets.push(index);
    }
  });

  if (!targets.length) {
    return { selected: [], formula: mode === "and" ? "0" : "1" };
  }

  if (targets.length === 2 ** varCount) {
    return { selected: [], formula: mode === "and" ? "1" : "0" };
  }

  const primes = primeImplicants(targets, dontCares, varCount);
  const cover = chooseCover(primes, targets);
  const selected = cover.indices.map((idx) => primes[idx]);
  const names = state.counterType === "reversible" ? mapVarNames(varCount, true) : qNames(varCount);
  const formula =
    mode === "and"
      ? selected.map((imp) => implicantToSop(imp, varCount, names)).join(" + ")
      : selected.map((imp) => implicantToPos(imp, varCount, names)).join(" · ");

  return { selected, formula };
}

function matchesImplicant(implicant, value) {
  return (value & implicant.mask) === implicant.bits;
}

function mergeImplicants(a, b) {
  if (a.mask !== b.mask) return null;
  const diff = a.bits ^ b.bits;
  if (diff === 0 || (diff & (diff - 1)) !== 0) return null;
  const mergedMask = a.mask & ~diff;
  const mergedBits = a.bits & mergedMask;
  return {
    bits: mergedBits,
    mask: mergedMask,
    covers: [...new Set([...a.covers, ...b.covers])],
  };
}

function uniqueImplicants(list) {
  const map = new Map();
  list.forEach((imp) => {
    const key = `${imp.bits}:${imp.mask}`;
    if (!map.has(key)) map.set(key, imp);
  });
  return [...map.values()];
}

function primeImplicants(targets, dontCares, bitCount) {
  const initialValues = [...targets, ...dontCares];
  let current = initialValues.map((value) => ({
    bits: value,
    mask: (1 << bitCount) - 1,
    covers: [value],
  }));
  const primes = [];

  while (current.length) {
    const next = [];
    const used = new Array(current.length).fill(false);

    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const merged = mergeImplicants(current[i], current[j]);
        if (merged) {
          used[i] = true;
          used[j] = true;
          next.push(merged);
        }
      }
    }

    current.forEach((imp, idx) => {
      if (!used[idx]) primes.push(imp);
    });

    current = uniqueImplicants(next);
  }

  return uniqueImplicants(primes);
}

function coveredTargets(implicant, targetSet) {
  return [...targetSet].filter((value) => matchesImplicant(implicant, value));
}

function chooseCover(primes, targets) {
  if (!targets.length) return [];

  const targetSet = new Set(targets);
  const coverage = primes.map((imp) => coveredTargets(imp, targetSet));
  const essential = new Set();

  targets.forEach((target) => {
    const covering = [];
    primes.forEach((imp, idx) => {
      if (coverage[idx].includes(target)) covering.push(idx);
    });
    if (covering.length === 1) essential.add(covering[0]);
  });

  function bitCountForMask(mask) {
    let count = 0;
    for (let i = 0; i < VAR_LIMIT; i++) if (mask & (1 << i)) count++;
    return count;
  }

  function score(indices) {
    let literals = 0;
    const covered = new Set();
    indices.forEach((idx) => {
      literals += bitCountForMask(primes[idx].mask);
      coverage[idx].forEach((value) => covered.add(value));
    });
    return { literals, covered };
  }

  const essentialIndices = [...essential];
  const coveredByEssential = new Set();
  essentialIndices.forEach((idx) => coverage[idx].forEach((value) => coveredByEssential.add(value)));

  if (coveredByEssential.size === targets.length) {
    return { indices: essentialIndices, literals: score(essentialIndices).literals };
  }

  const candidates = primes
    .map((imp, idx) => ({ imp, idx, covers: coverage[idx] }))
    .filter((item) => !essential.has(item.idx) && item.covers.length > 0)
    .sort((a, b) => b.covers.length - a.covers.length || bitCountForMask(a.imp.mask) - bitCountForMask(b.imp.mask));

  let best = null;

  function search(start, picked, covered) {
    if (covered.size === targets.length) {
      const indices = [...essentialIndices, ...picked.map((p) => p.idx)];
      const { literals } = score(indices);
      if (
        !best ||
        indices.length < best.indices.length ||
        (indices.length === best.indices.length && literals < best.literals)
      ) {
        best = { indices, literals };
      }
      return;
    }

    if (best && essentialIndices.length + picked.length >= best.indices.length) return;

    const uncovered = targets.filter((value) => !covered.has(value));
    if (!uncovered.length) return;
    const target = uncovered[0];

    for (let i = start; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (!candidate.covers.includes(target)) continue;
      const nextCovered = new Set(covered);
      candidate.covers.forEach((value) => nextCovered.add(value));
      picked.push(candidate);
      search(i + 1, picked, nextCovered);
      picked.pop();
    }
  }

  search(0, [], coveredByEssential);
  if (!best) return { indices: essentialIndices, literals: score(essentialIndices).literals };
  return best;
}

function implicantToSop(implicant, varCount, names = qNames(varCount)) {
  const parts = [];
  for (let bit = 0; bit < varCount; bit++) {
    const maskBit = 1 << (varCount - bit - 1);
    if (!(implicant.mask & maskBit)) continue;
    const name = names[bit];
    const value = (implicant.bits & maskBit) ? 1 : 0;
    parts.push(value ? name : `${name}'`);
  }
  return parts.length ? parts.join("") : "1";
}

function implicantToPos(implicant, varCount, names = qNames(varCount)) {
  const parts = [];
  for (let bit = 0; bit < varCount; bit++) {
    const maskBit = 1 << (varCount - bit - 1);
    if (!(implicant.mask & maskBit)) continue;
    const name = names[bit];
    const value = (implicant.bits & maskBit) ? 1 : 0;
    parts.push(value ? `${name}'` : name);
  }
  return parts.length ? `(${parts.join(" + ")})` : "(0)";
}

function analyzeValue(values, bitCount, basisType) {
  if (basisType === "and") {
    return { basis: "SOP", ...collectImplicants(values, bitCount, "and") };
  }
  if (basisType === "or") {
    return { basis: "POS", ...collectImplicants(values, bitCount, "or") };
  }

  const sopData = collectImplicants(values, bitCount, "and");
  const posData = collectImplicants(values, bitCount, "or");
  const sop = sopData.formula;
  const pos = posData.formula;
  if (pos.length < sop.length) return { basis: "POS", formula: pos, selected: posData.selected };
  return { basis: "SOP", formula: sop, selected: sopData.selected };
}

function mapLayout(bitCount) {
  const vars = totalMapVars(bitCount);
  if (vars === 1) return { extraBits: 0, rowBits: 0, colBits: 1 };
  if (vars === 2) return { extraBits: 0, rowBits: 1, colBits: 1 };
  if (vars === 3) return { extraBits: 0, rowBits: 1, colBits: 2 };
  return { extraBits: Math.max(0, vars - 4), rowBits: 2, colBits: 2 };
}

function stateTableColumns(bitCount) {
  const titles = qNames(bitCount);
  const ffColumns = [];
  if (state.ffType === "D" || state.ffType === "T") {
    for (let i = 1; i <= bitCount; i++) ffColumns.push(`${state.ffType}${i}`);
  } else if (state.ffType === "RS") {
    for (let i = 1; i <= bitCount; i++) ffColumns.push(`R${i}`, `S${i}`);
  } else {
    for (let i = 1; i <= bitCount; i++) ffColumns.push(`J${i}`, `K${i}`);
  }

  return {
    titles,
    headers: ["Состояние", `Код (${titles.join(", ")})`, "Следующее", `Код (${titles.join(", ")})`, ...ffColumns],
  };
}

function stateTableRowCells(row) {
  const cells = [String(row.value), bitsText(row.currentBits), String(row.next), bitsText(row.nextBits)];
  if (state.ffType === "D" || state.ffType === "T") {
    row.excitations.forEach((exc) => cells.push(String(exc[state.ffType])));
  } else if (state.ffType === "RS") {
    row.excitations.forEach((exc) => cells.push(String(exc.R), String(exc.S)));
  } else {
    row.excitations.forEach((exc) => cells.push(String(exc.J), String(exc.K)));
  }
  return cells;
}

function displayRows(rows) {
  return state.stateTableFlipped ? [...rows].reverse() : rows;
}

function stateTableToTsv(scenario, bitCount) {
  const { headers } = stateTableColumns(bitCount);
  const rows = displayRows(buildRows(scenario, bitCount));
  return [headers, ...rows.map(stateTableRowCells)].map((line) => line.join("\t")).join("\n");
}

function allStateTablesToTsv(scenarioList, bitCount) {
  return scenarioList.map((scenario) => `${scenario.label}\n${stateTableToTsv(scenario, bitCount)}`).join("\n\n");
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function flashButton(button, text = "Copied") {
  const original = button.textContent;
  button.textContent = text;
  button.disabled = true;
  setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1000);
}

function renderStateTableSection(scenario, bitCount) {
  const rows = displayRows(buildRows(scenario, bitCount));
  const { titles, headers } = stateTableColumns(bitCount);
  const ffColumns = headers.slice(4);

  const section = document.createElement("section");
  section.className = "panel state-section";

  const head = document.createElement("div");
  head.className = "section-head";
  head.innerHTML = `
    <div>
      <div class="eyebrow">${scenario.label}</div>
      <h2>${titles.join(", ")} · ${bitCount} bit</h2>
    </div>
  `;
  const actions = document.createElement("div");
  actions.className = "section-actions";
  const copyButton = document.createElement("button");
  copyButton.className = "action-button";
  copyButton.type = "button";
  copyButton.textContent = "Copy table";
  copyButton.addEventListener("click", async () => {
    await copyText(stateTableToTsv(scenario, bitCount));
    flashButton(copyButton);
  });
  actions.appendChild(copyButton);
  head.appendChild(actions);
  section.appendChild(head);

  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap";

  const table = document.createElement("table");
  table.className = "data-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Состояние", `Код (${titles.join(", ")})`, "Следующее", `Код (${titles.join(", ")})`, ...ffColumns].forEach((text) =>
    headRow.appendChild(makeCell("th", text))
  );
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = "used";
    stateTableRowCells(row).forEach((value) => tr.appendChild(makeCell("td", value)));

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  section.appendChild(tableWrap);
  return section;
}

function renderMapCard(title, values, varCount, extraBits = [], methodLabel = "SOP", groups = []) {
  const layout = mapLayout(varCount - (state.counterType === "reversible" ? 1 : 0));
  const totalVars = varCount;
  const rowLabels = grayStrings(layout.rowBits);
  const colLabels = grayStrings(layout.colBits);
  const names = mapVarNames(totalVars, state.counterType === "reversible");
  const extraNames = names.slice(0, layout.extraBits);
  const rowVars = names.slice(layout.extraBits, layout.extraBits + layout.rowBits);
  const colVars = names.slice(layout.extraBits + layout.rowBits, layout.extraBits + layout.rowBits + layout.colBits);

  const card = document.createElement("article");
  card.className = `kmap-card best method-${methodLabel.toLowerCase()}`;

  const header = document.createElement("div");
  header.className = "kmap-header";
  const selectorLabel = extraNames.length
    ? `${extraNames.join("")}=${extraBits.join("")}`
    : state.counterType === "reversible"
      ? "α"
      : "-";
  header.innerHTML = `
    <strong>${title}</strong>
    <span class="mono">selector: ${selectorLabel}</span>
  `;
  card.appendChild(header);

  const axis = document.createElement("div");
  axis.className = "axis-label";
  axis.textContent = `${extraNames.join("")}${rowVars.length ? rowVars.join("") : ""}\\${colVars.length ? colVars.join("") : "-"}`;
  card.appendChild(axis);

  const grid = document.createElement("div");
  const gridSize = Math.max(1, Math.min(4, Math.max(rowLabels.length, colLabels.length)));
  grid.className = `kmap grid-${gridSize}`;

  grid.appendChild(makeCell("div", rowVars.length ? rowVars.join("") : "Q1"));
  colLabels.forEach((labelText) => grid.appendChild(makeCell("div", labelText)));

  rowLabels.forEach((rowLabel, rowIndex) => {
    grid.appendChild(makeCell("div", rowLabel));
    colLabels.forEach((colLabel, colIndex) => {
      const rowBits = rowLabel === "" ? [] : rowLabel.split("").map(Number);
      const colBits = colLabel === "" ? [] : colLabel.split("").map(Number);
      const bits = [...extraBits, ...rowBits, ...colBits].map(Number);
      const code = bitsToValue(bits);
      const value = values[code] ?? "X";
      const cell = document.createElement("div");
      cell.className = "kcell";
      cell.textContent = value;
      cell.dataset.row = String(rowIndex);
      cell.dataset.col = String(colIndex);
      cell.dataset.index = String(code);
      if (value === 1 || value === "1") cell.classList.add("one");
      else if (value === 0 || value === "0") cell.classList.add("zero");
      else cell.classList.add("dc");
      grid.appendChild(cell);
    });
  });

  const overlay = document.createElement("div");
  overlay.className = "map-overlay";
  card.appendChild(grid);
  card.appendChild(overlay);

  if (groups.length) {
    requestAnimationFrame(() => drawGroupOverlays(card, groups, totalVars, extraBits, rowLabels, colLabels, layout));
  }
  return card;
}

function drawGroupOverlays(card, groups, totalVars, extraBits, rowLabels, colLabels, layout) {
  if (!card.isConnected) return;
  const overlay = card.querySelector(".map-overlay");
  if (!overlay) return;
  overlay.innerHTML = "";

  const cells = [...card.querySelectorAll(".kcell[data-index]")];
  const cardRect = card.getBoundingClientRect();
  const colors = ["rgba(124,242,208,0.95)", "rgba(134,167,255,0.95)", "rgba(255,201,111,0.95)", "rgba(255,122,163,0.95)"];

  groups.forEach((group, idx) => {
    const covered = cells.filter((cell) => matchesImplicant(group, Number(cell.dataset.index)));
    if (!covered.length) return;
    const rects = covered.map((cell) => cell.getBoundingClientRect());
    const left = Math.min(...rects.map((r) => r.left)) - cardRect.left;
    const top = Math.min(...rects.map((r) => r.top)) - cardRect.top;
    const right = Math.max(...rects.map((r) => r.right)) - cardRect.left;
    const bottom = Math.max(...rects.map((r) => r.bottom)) - cardRect.top;

    const box = document.createElement("div");
    box.className = "group-box";
    box.style.left = `${left - 4}px`;
    box.style.top = `${top - 4}px`;
    box.style.width = `${right - left + 8}px`;
    box.style.height = `${bottom - top + 8}px`;
    box.style.borderColor = colors[idx % colors.length];
    box.style.boxShadow = `0 0 0 1px ${colors[idx % colors.length]}`;
    box.innerHTML = `<span class="group-label">G${idx + 1}</span>`;
    overlay.appendChild(box);
  });
}

function renderFunctionSection(bitCount, combined) {
  const { functions, used } = combined;
  const body = document.createDocumentFragment();
  const varCount = totalMapVars(bitCount);

  Object.entries(functions).forEach(([name, values]) => {
    const wrap = document.createElement("div");
    wrap.className = "map-group";

    const analysis = analyzeValue(values, varCount, state.basisType);

    const title = document.createElement("div");
    title.className = `map-title method-${analysis.basis.toLowerCase()}`;
    title.textContent = state.basisType === "boolean" ? `${name} -> ${analysis.basis}` : `${name} -> ${analysis.basis}`;
    wrap.appendChild(title);

    const cardsWrap = document.createElement("div");
    cardsWrap.className = "kmap-blocks";

    if (varCount <= 4) {
      cardsWrap.appendChild(renderMapCard(name, values, varCount, [], analysis.basis, analysis.selected));
    } else {
      const extraCount = varCount - 4;
      grayStrings(extraCount).forEach((selector) => {
        cardsWrap.appendChild(renderMapCard(name, values, varCount, selector.split("").filter(Boolean), analysis.basis, analysis.selected));
      });
    }

    const equation = document.createElement("div");
    equation.className = `equation best method-${analysis.basis.toLowerCase()}`;
    equation.innerHTML = `
      <div class="label">Min formula</div>
      <div class="formula">${analysis.formula}</div>
    `;

    wrap.appendChild(cardsWrap);
    wrap.appendChild(equation);
    body.appendChild(wrap);
  });

  void used;
  return body;
}

function renderFinalSection(scenariosList, bitCount, combined) {
  const wrap = document.createDocumentFragment();
  const varCount = totalMapVars(bitCount);
  const { functions } = combined;

  Object.entries(functions).forEach(([name, values]) => {
    const analysis = analyzeValue(values, varCount, state.basisType);
    const item = document.createElement("div");
    item.className = `final-item best method-${analysis.basis.toLowerCase()}`;
    item.innerHTML = `
      <strong>${name} -> ${analysis.basis}</strong>
      <div class="formula">${analysis.formula}</div>
    `;
    wrap.appendChild(item);
  });

  void scenariosList;
  return wrap;
}

function updateVisibility() {
  const reversible = state.counterType === "reversible";
  singleLimitWrapEl.hidden = reversible;
  upLimitWrapEl.hidden = !reversible;
  downLimitWrapEl.hidden = !reversible;
}

function render() {
  state.counterType = counterTypeEl.value;
  state.singleLimit = clampInt(singleLimitEl.value, 1, 32, 13);
  state.upLimit = clampInt(upLimitEl.value, 1, 32, 7);
  state.downLimit = clampInt(downLimitEl.value, 1, 32, 5);
  state.ffType = ffTypeEl.value;
  state.basisType = basisTypeEl.value;

  singleLimitEl.value = state.singleLimit;
  upLimitEl.value = state.upLimit;
  downLimitEl.value = state.downLimit;

  updateVisibility();

  const scenarioList = scenarios();
  const bitCount = activeBitCount(scenarioList);
  const varCount = totalMapVars(bitCount);
  const combined = buildCombinedFunctionValues(scenarioList, bitCount);

  bitCountEl.textContent = String(bitCount);
  stateCountEl.textContent = scenarioList.length === 1 ? `${scenarioList[0].limit + 1}` : `${scenarioList[0].limit + 1} / ${scenarioList[1].limit + 1}`;
  unusedCountEl.textContent = String((2 ** varCount) - combined.used.size);
  stateOrderToggleEl.textContent = state.stateTableFlipped ? "Normal order" : "Flip";

  stateAreaEl.innerHTML = "";
  mapsAreaEl.innerHTML = "";
  finalAreaEl.innerHTML = "";

  const stateScenarioList = state.stateTableFlipped ? [...scenarioList].reverse() : scenarioList;
  stateScenarioList.forEach((scenario) => {
    stateAreaEl.appendChild(renderStateTableSection(scenario, bitCount));
  });

  mapsAreaEl.appendChild(renderFunctionSection(bitCount, combined));
  finalAreaEl.appendChild(renderFinalSection(scenarioList, bitCount, combined));
}

[counterTypeEl, singleLimitEl, upLimitEl, downLimitEl, ffTypeEl, basisTypeEl].forEach((el) => {
  el.addEventListener("input", render);
  el.addEventListener("change", render);
});

stateOrderToggleEl.addEventListener("click", () => {
  state.stateTableFlipped = !state.stateTableFlipped;
  render();
});

copyAllStatesEl.addEventListener("click", async () => {
  const scenarioList = scenarios();
  const bitCount = activeBitCount(scenarioList);
  await copyText(allStateTablesToTsv(scenarioList, bitCount));
  flashButton(copyAllStatesEl);
});

render();
