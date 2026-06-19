// ============================
// DOM
// ============================
const form = document.getElementById("solverForm");
const sizeInput = document.getElementById("size");
const matrixContainer = document.getElementById("matrixInputs");

const rootBox = document.getElementById("rootBox");
const statsGrid = document.getElementById("statsGrid");
const stepPanel = document.getElementById("stepPanel");
const emptyState = document.getElementById("emptyState");

const finalRootEl = document.getElementById("finalRoot");
const methodNameEl = document.getElementById("methodName");
const matrixSizeEl = document.getElementById("matrixSize");
const statusEl = document.getElementById("status");

const matrixView = document.getElementById("matrixView");
const stepDesc = document.getElementById("stepDesc");

const messageBox = document.getElementById("message");
const resetBtn = document.getElementById("resetBtn");

const firstBtn = document.getElementById("firstBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const lastBtn = document.getElementById("lastBtn");
const playBtn = document.getElementById("playBtn");

// ============================
// STATE
// ============================
let steps = [];
let currentStep = 0;
let playTimer = null;

// ============================
// MATRIX INPUT
// ============================
function renderMatrixInputs() {
  const n = Number(sizeInput.value);
  matrixContainer.innerHTML = "";

  for (let i = 0; i < n; i++) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "6px";

    for (let j = 0; j < n; j++) {
      const input = document.createElement("input");
      input.type = "number";
      input.step = "any";
      input.value = i === j ? 2 : 1;
      input.id = `a-${i}-${j}`;
      row.appendChild(input);
    }

    const bInput = document.createElement("input");
    bInput.type = "number";
    bInput.value = 1;
    bInput.id = `b-${i}`;
    bInput.style.marginLeft = "10px";

    row.appendChild(bInput);
    matrixContainer.appendChild(row);
  }
}
sizeInput.addEventListener("input", renderMatrixInputs);
renderMatrixInputs();

// ============================
// HELPERS
// ============================
function deepCopy(A) {
  return A.map(r => [...r]);
}

function record(A, b, desc, highlight = {}) {
  steps.push({
    A: deepCopy(A),
    b: [...b],
    desc,
    highlight
  });
}

function format(v) {
  return Number.isFinite(v) ? Number(v.toFixed(4)) : "—";
}

// ============================
// MATRIX RENDER
// ============================
function renderMatrix(A, b, h = {}) {
  return `
    <table>
      ${A.map((row, i) => `
        <tr>
          ${row.map((v, j) => {
            let style = "";
            if (h.pivotRow === i && h.pivotCol === j)
              style += "background:#fde68a; box-shadow:0 0 10px #f59e0b;";
            else if (h.pivotRow === i) style += "background:#dbeafe;";
            else if (h.activeRow === i) style += "background:#fecaca;";
            else if (h.pivotCol === j) style += "background:#fef9c3;";

            return `<td style="${style}">${format(v)}</td>`;
          }).join("")}
          <td style="border-left:2px solid black">${format(b[i])}</td>
        </tr>
      `).join("")}
    </table>
  `;
}

function renderStep() {
  if (!steps.length) return;
  const s = steps[currentStep];

  matrixView.style.opacity = 0;

  setTimeout(() => {
    matrixView.innerHTML = renderMatrix(s.A, s.b, s.highlight);
    stepDesc.innerHTML = `<strong>Step ${currentStep + 1}:</strong> ${s.desc}`;
    matrixView.style.opacity = 1;
  }, 120);
}

// ============================
// CONTROLS
// ============================
firstBtn.onclick = () => { currentStep = 0; renderStep(); };
prevBtn.onclick = () => { if (currentStep > 0) currentStep--; renderStep(); };
nextBtn.onclick = () => { if (currentStep < steps.length - 1) currentStep++; renderStep(); };
lastBtn.onclick = () => { currentStep = steps.length - 1; renderStep(); };

playBtn.onclick = () => {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
    playBtn.textContent = "Play";
    return;
  }

  playBtn.textContent = "Pause";

  playTimer = setInterval(() => {
    if (currentStep >= steps.length - 1) {
      clearInterval(playTimer);
      playTimer = null;
      playBtn.textContent = "Play";
      return;
    }
    currentStep++;
    renderStep();
  }, 900);
};

// ============================
// GET SYSTEM
// ============================
function getSystem() {
  const n = Number(sizeInput.value);
  const A = [];
  const b = [];

  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      row.push(Number(document.getElementById(`a-${i}-${j}`).value));
    }
    A.push(row);
    b.push(Number(document.getElementById(`b-${i}`).value));
  }

  return { A, b };
}

// ============================
// DETERMINANT (stable)
// ============================
function determinant(A) {
  const M = deepCopy(A);
  let det = 1;

  for (let i = 0; i < M.length; i++) {
    if (Math.abs(M[i][i]) < 1e-12) return 0;

    for (let k = i + 1; k < M.length; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j < M.length; j++) {
        M[k][j] -= f * M[i][j];
      }
    }
    det *= M[i][i];
  }

  return det;
}

// ============================
// GAUSS
// ============================
function gauss(A, b) {
  record(A, b, "Start Gaussian elimination");

  for (let i = 0; i < A.length; i++) {
    record(A, b,
      `Select pivot at column ${i+1}. This value is used to eliminate entries below.`,
      { pivotRow: i, pivotCol: i });

    for (let k = i + 1; k < A.length; k++) {
      const f = A[k][i] / A[i][i];

      record(A, b,
        `Compute multiplier = ${format(A[k][i])} / ${format(A[i][i])} = ${format(f)}`
      );

      for (let j = i; j < A.length; j++) {
        A[k][j] -= f * A[i][j];
      }
      b[k] -= f * b[i];

      record(A, b,
        `Row ${k+1} updated to eliminate variable x${i+1}`,
        { activeRow: k });
    }
  }

  const x = Array(A.length).fill(0);

  for (let i = A.length - 1; i >= 0; i--) {
    let sum = b[i];

    for (let j = i + 1; j < A.length; j++) {
      sum -= A[i][j] * x[j];
    }

    x[i] = sum / A[i][i];

    record(A, b,
      `Back substitution: x${i+1} = (${format(sum)}) / ${format(A[i][i])} = ${format(x[i])}`
    );
  }

  return x;
}

// ============================
// GAUSS-JORDAN
// ============================
function gaussJordan(A, b) {
  record(A, b, "Start Gauss-Jordan elimination");

  for (let i = 0; i < A.length; i++) {
    let pivot = A[i][i];

    for (let j = 0; j < A.length; j++) A[i][j] /= pivot;
    b[i] /= pivot;

    record(A, b,
      `Normalize row ${i+1} so pivot becomes 1`,
      { pivotRow: i, pivotCol: i });

    for (let k = 0; k < A.length; k++) {
      if (k === i) continue;

      let f = A[k][i];

      for (let j = 0; j < A.length; j++) {
        A[k][j] -= f * A[i][j];
      }
      b[k] -= f * b[i];

      record(A, b,
        `Eliminate column ${i+1} from row ${k+1}`,
        { activeRow: k });
    }
  }

  return b;
}

// ============================
// CRAMER
// ============================
function cramer(A, b) {
  const detA = determinant(A);
  if (Math.abs(detA) < 1e-12) throw Error("Singular matrix");

  record(A, b, `Compute det(A) = ${format(detA)}`);

  const x = [];

  for (let i = 0; i < A.length; i++) {
    const Ai = A.map((row, r) =>
      row.map((v, c) => (c === i ? b[r] : v))
    );

    const detAi = determinant(Ai);

    x[i] = detAi / detA;

    record(Ai, b,
      `Replace column ${i+1}. det(A${i+1})=${format(detAi)} → x${i+1}=${format(x[i])}`,
      { pivotCol: i });
  }

  return x;
}

// ============================
// LU (correct solution)
// ============================
function lu(A, b) {
  const n = A.length;
  const L = Array.from({ length: n }, () => Array(n).fill(0));
  const U = deepCopy(A);

  record(A, b, "Start LU decomposition");

  for (let i = 0; i < n; i++) {
    for (let k = i + 1; k < n; k++) {
      L[k][i] = U[k][i] / U[i][i];

      for (let j = i; j < n; j++) {
        U[k][j] -= L[k][i] * U[i][j];
      }

      record(U, b,
        `Eliminate entry (${k+1},${i+1})`,
        { pivotRow: i, activeRow: k });
    }

    L[i][i] = 1;
    record(L, b, `Update L matrix`);
  }

  // Forward substitution
  const y = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = b[i];
    for (let j = 0; j < i; j++) sum -= L[i][j] * y[j];
    y[i] = sum;
  }

  // Back substitution
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i];
    for (let j = i + 1; j < n; j++) sum -= U[i][j] * x[j];
    x[i] = sum / U[i][i];
  }

  record(U, b, "Solve Ux = y");

  return x;
}

// ============================
// MAIN
// ============================
form.addEventListener("submit", e => {
  e.preventDefault();

  steps = [];
  currentStep = 0;
  messageBox.textContent = "";

  try {
    const { A, b } = getSystem();
    const method = document.getElementById("method").value;

    let result;

    if (method === "gauss") result = gauss(deepCopy(A), [...b]);
    else if (method === "gauss-jordan") result = gaussJordan(deepCopy(A), [...b]);
    else if (method === "cramer") result = cramer(A, b);
    else result = lu(A, b);

    finalRootEl.textContent = result.map(v => v.toFixed(4)).join(", ");
    methodNameEl.textContent = method;
    matrixSizeEl.textContent = `${A.length} x ${A.length}`;
    statusEl.textContent = "Success";

    renderStep();

    rootBox.classList.add("show");
    statsGrid.classList.add("show");
    stepPanel.classList.add("show");
    emptyState.style.display = "none";

    if (window.Analytics) {
      window.Analytics.track('solver_run', {
        method: method,
        type: 'linear',
        size: A.length,
        steps: steps.length
      });
    }

  } catch (err) {
    messageBox.textContent = err.message;
    messageBox.className = "message error";

    if (window.Analytics) {
      window.Analytics.track('solver_error', {
        method: document.getElementById('method').value,
        type: 'linear',
        error: err.message
      });
    }
  }
});

// ============================
// RESET
// ============================
resetBtn.onclick = () => {
  renderMatrixInputs();
  steps = [];
  currentStep = 0;
  matrixView.innerHTML = "";
  stepDesc.innerHTML = "";
};