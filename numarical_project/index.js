
    /*
      =========================================================
      Nonlinear Equation Solver
      Methods:
        1. Bisection Method
        2. False Position Method

      This project uses:
        - Vanilla JavaScript
        - Custom expression parser
        - HTML Canvas graph
      =========================================================
    */

    const form = document.getElementById("solverForm");
    const equationInput = document.getElementById("equation");
    const methodInput = document.getElementById("method");
    const xlInput = document.getElementById("xl");
    const xuInput = document.getElementById("xu");
    const x0Input = document.getElementById("x0");
    const x0Group = document.getElementById("x0-group");
    const x1Input = document.getElementById("x1");
    const x1Group = document.getElementById("x1-group");
    const gInput = document.getElementById("gfunc");
    const gGroup = document.getElementById("g-group");
    const epsInput = document.getElementById("eps");

    const messageBox = document.getElementById("message");
    const rootBox = document.getElementById("rootBox");
    const finalRootEl = document.getElementById("finalRoot");
    const statsGrid = document.getElementById("statsGrid");
    const iterationCountEl = document.getElementById("iterationCount");
    const finalErrorEl = document.getElementById("finalError");
    const finalFxEl = document.getElementById("finalFx");

    const graphCard = document.getElementById("graphCard");
    const canvas = document.getElementById("graphCanvas");

    const tableWrapper = document.getElementById("tableWrapper");
    const resultBody = document.getElementById("resultBody");
    const emptyState = document.getElementById("emptyState");

    const stepPanel = document.getElementById("stepPanel");
    const stepText = document.getElementById("stepText");

    const firstStepBtn = document.getElementById("firstStepBtn");
    const prevStepBtn = document.getElementById("prevStepBtn");
    const nextStepBtn = document.getElementById("nextStepBtn");
    const lastStepBtn = document.getElementById("lastStepBtn");
    const playBtn = document.getElementById("playBtn");
    const resetBtn = document.getElementById("resetBtn");

    let iterations = [];
    let selectedStep = 0;
    let playTimer = null;
    let latestFunction = null;
    let latestBounds = null;

    const MAX_ITERATIONS = 100;

    /*
      ---------------------------------------------------------
      Supported mathematical functions
      ---------------------------------------------------------
    */
    const FUNCTIONS = {
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      sqrt: Math.sqrt,
      abs: Math.abs,
      ln: Math.log,
      log: Math.log,
      log10: Math.log10,
      exp: Math.exp,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round
    };

    const CONSTANTS = {
      pi: Math.PI,
      e: Math.E
    };

    /*
      ---------------------------------------------------------
      Tokenizer
      Converts a string like "4*x^3 - cos(x)" into tokens.
      It also supports implicit multiplication:
        2x      -> 2*x
        2sin(x) -> 2*sin(x)
        x(x+1) -> x*(x+1)
      ---------------------------------------------------------
    */
    function tokenize(expression) {
      const input = expression
        .replaceAll("−", "-")
        .replaceAll("×", "*")
        .replaceAll("÷", "/")
        .trim();

      if (!input) {
        throw new Error("Equation cannot be empty.");
      }

      const tokens = [];
      let i = 0;

      while (i < input.length) {
        const char = input[i];

        if (/\s/.test(char)) {
          i++;
          continue;
        }

        // Number parser with decimal and scientific notation support.
        if (/\d|\./.test(char)) {
          let start = i;
          let hasDot = false;

          while (i < input.length && /[\d.]/.test(input[i])) {
            if (input[i] === ".") {
              if (hasDot) {
                throw new Error("Invalid number format.");
              }
              hasDot = true;
            }
            i++;
          }

          // Scientific notation, e.g. 1e-3
          if (
            i < input.length &&
            /e/i.test(input[i]) &&
            i + 1 < input.length &&
            /[+\-\d]/.test(input[i + 1])
          ) {
            i++;
            if (/[+\-]/.test(input[i])) i++;

            if (i >= input.length || !/\d/.test(input[i])) {
              throw new Error("Invalid scientific notation.");
            }

            while (i < input.length && /\d/.test(input[i])) {
              i++;
            }
          }

          const value = Number(input.slice(start, i));

          if (!Number.isFinite(value)) {
            throw new Error("Invalid number in equation.");
          }

          tokens.push({ type: "number", value });
          continue;
        }

        // Identifier parser: x, sin, cos, pi, etc.
        if (/[a-zA-Z_]/.test(char)) {
          let start = i;

          while (i < input.length && /[a-zA-Z_]/.test(input[i])) {
            i++;
          }

          const name = input.slice(start, i).toLowerCase();

          if (name === "x") {
            tokens.push({ type: "variable" });
          } else if (name in CONSTANTS) {
            tokens.push({ type: "constant", value: CONSTANTS[name] });
          } else if (name in FUNCTIONS) {
            tokens.push({ type: "function", name });
          } else {
            throw new Error(
              `Unknown identifier "${name}". Use x, constants pi/e, or supported functions.`
            );
          }

          continue;
        }

        if ("+-*/^".includes(char)) {
          tokens.push({ type: "operator", value: char });
          i++;
          continue;
        }

        if (char === "(") {
          tokens.push({ type: "leftParen" });
          i++;
          continue;
        }

        if (char === ")") {
          tokens.push({ type: "rightParen" });
          i++;
          continue;
        }

        throw new Error(`Invalid character "${char}" in equation.`);
      }

      return insertImplicitMultiplication(tokens);
    }

    function insertImplicitMultiplication(tokens) {
      const result = [];

      for (let i = 0; i < tokens.length; i++) {
        const current = tokens[i];
        const previous = result[result.length - 1];

        if (previous && shouldInsertMultiply(previous, current)) {
          result.push({ type: "operator", value: "*" });
        }

        result.push(current);
      }

      return result;
    }

    function isValueToken(token) {
      return (
        token.type === "number" ||
        token.type === "variable" ||
        token.type === "constant" ||
        token.type === "rightParen"
      );
    }

    function startsValueToken(token) {
      return (
        token.type === "number" ||
        token.type === "variable" ||
        token.type === "constant" ||
        token.type === "function" ||
        token.type === "leftParen"
      );
    }

    function shouldInsertMultiply(previous, current) {
      return isValueToken(previous) && startsValueToken(current);
    }

    /*
      ---------------------------------------------------------
      Recursive descent parser
      Builds a JavaScript function f(x) from tokens.

      Grammar:
        expression -> term ((+ | -) term)*
        term       -> unary ((* | /) unary)*
        unary      -> (+ | -) unary | power
        power      -> primary (^ unary)?
        primary    -> number | x | constant | func(expression) | (expression)
      ---------------------------------------------------------
    */
    function compileExpression(expression) {
      const tokens = tokenize(expression);
      let position = 0;

      function peek() {
        return tokens[position];
      }
      function consume() {
        return tokens[position++];
      }

      function matchOperator(operator) {
        const token = peek();

        if (token && token.type === "operator" && token.value === operator) {
          consume();
          return true;
        }

        return false;
      }

      function parseExpression() {
        let left = parseTerm();

        while (true) {
          if (matchOperator("+")) {
            const right = parseTerm();
            const leftFn = left;
            left = x => leftFn(x) + right(x);
          } else if (matchOperator("-")) {
            const right = parseTerm();
            const leftFn = left;
            left = x => leftFn(x) - right(x);
          } else {
            break;
          }
        }

        return left;
      }

      function parseTerm() {
        let left = parseUnary();

        while (true) {
          if (matchOperator("*")) {
            const right = parseUnary();
            const leftFn = left;
            left = x => leftFn(x) * right(x);
          } else if (matchOperator("/")) {
            const right = parseUnary();
            const leftFn = left;
            left = x => leftFn(x) / right(x);
          } else {
            break;
          }
        }

        return left;
      }

      function parseUnary() {
        if (matchOperator("+")) {
          return parseUnary();
        }

        if (matchOperator("-")) {
          const operand = parseUnary();
          return x => -operand(x);
        }

        return parsePower();
      }

      function parsePower() {
        let base = parsePrimary();

        if (matchOperator("^")) {
          const exponent = parseUnary();
          const baseFn = base;
          base = x => Math.pow(baseFn(x), exponent(x));
        }

        return base;
      }

      function parsePrimary() {
        const token = peek();

        if (!token) {
          throw new Error("Unexpected end of equation.");
        }

        if (token.type === "number") {
          consume();
          return () => token.value;
        }

        if (token.type === "constant") {
          consume();
          return () => token.value;
        }

        if (token.type === "variable") {
          consume();
          return x => x;
        }

        if (token.type === "function") {
          consume();
          const functionName = token.name;

          const next = consume();
          if (!next || next.type !== "leftParen") {
            throw new Error(`Function "${functionName}" must be followed by parentheses.`);
          }

          const argument = parseExpression();

          const closing = consume();
          if (!closing || closing.type !== "rightParen") {
            throw new Error(`Missing closing parenthesis after "${functionName}".`);
          }

          return x => FUNCTIONS[functionName](argument(x));
        }

        if (token.type === "leftParen") {
          consume();
          const expression = parseExpression();

          const closing = consume();
          if (!closing || closing.type !== "rightParen") {
            throw new Error("Missing closing parenthesis.");
          }

          return expression;
        }

        throw new Error("Invalid equation syntax.");
      }

      const parsedFunction = parseExpression();

      if (position < tokens.length) {
        throw new Error("Invalid equation syntax near the end of the expression.");
      }

      return x => {
        const value = parsedFunction(x);

        if (typeof value !== "number" || Number.isNaN(value)) {
          throw new Error("Equation produced an invalid numerical value.");
        }

        return value;
      };
    }

async function remoteSolve(payload) {
  const response = await fetch("http://127.0.0.1:18080/api/solve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  console.log("HTTP Status:", response.status);

  const rawText = await response.text();

  console.log("RAW RESPONSE:", rawText);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return JSON.parse(rawText);
}

// Toggle UI inputs when method changes
function onMethodChange() {
  const m = methodInput.value;
  // Default: show interval inputs and hide specialised groups
  xlInput.parentElement.style.display = '';
  xuInput.parentElement.style.display = '';
  if (x0Group) x0Group.style.display = 'none';
  if (x1Group) x1Group.style.display = 'none';
  if (gGroup) gGroup.style.display = 'none';

  if (m === 'newton') {
    // Newton uses x0 only
    xlInput.parentElement.style.display = 'none';
    xuInput.parentElement.style.display = 'none';
    if (x0Group) x0Group.style.display = 'block';
  } else if (m === 'secant') {
    // Secant uses x0 and x1 (two initial guesses)
    xlInput.parentElement.style.display = 'none';
    xuInput.parentElement.style.display = 'none';
    if (x0Group) x0Group.style.display = 'block';
    if (x1Group) x1Group.style.display = 'block';
  } else if (m === 'fixed_point' || m === 'fixed-point') {
    // Fixed point uses g(x) and x0
    xlInput.parentElement.style.display = 'none';
    xuInput.parentElement.style.display = 'none';
    if (gGroup) gGroup.style.display = 'block';
    if (x0Group) x0Group.style.display = 'block';
  }
}

methodInput.addEventListener('change', onMethodChange);
// initialize visibility
onMethodChange();

    /*
      ---------------------------------------------------------
      Numerical methods
      ---------------------------------------------------------
    */
    function solveEquation({ method, equation, xl, xu, eps }) {
      const f = compileExpression(equation);

      let fxl = f(xl);
      let fxu = f(xu);

      if (!Number.isFinite(fxl) || !Number.isFinite(fxu)) {
        throw new Error("f(xl) or f(xu) is not finite. Try different bounds.");
      }

      if (fxl * fxu >= 0) {
        throw new Error(
          `Invalid interval: f(xl) × f(xu) must be less than 0. Current product is ${formatNumber(
            fxl * fxu
          )}.`
        );
      }

      const rows = [];
      let xrOld = null;

      for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
        let xr;

        if (method === "bisection") {
          xr = (xl + xu) / 2;
        } else {
          // False Position formula:
          // xr = xu - f(xu) * (xl - xu) / (f(xl) - f(xu))
          xr = xu - (fxu * (xl - xu)) / (fxl - fxu);
        }

        const fxr = f(xr);

        if (!Number.isFinite(fxr)) {
          throw new Error(`f(xr) became non-finite at iteration ${iteration}.`);
        }

        let error = null;

        if (xrOld !== null) {
          const denominator = Math.abs(xr) > Number.EPSILON ? Math.abs(xr) : 1;
          error = Math.abs((xr - xrOld) / denominator) * 100;
        }

        const row = {
          iteration,
          xl,
          xu,
          xr,
          fxr,
          error
        };

        rows.push(row);

        if (fxr === 0) {
          row.error = 0;
          break;
        }

        if (fxl * fxr < 0) {
          xu = xr;
          fxu = fxr;
        } else {
          xl = xr;
          fxl = fxr;
        }

        if (error !== null && error <= eps) {
          break;
        }

        xrOld = xr;
      }

      return {
        f,
        rows
      };
    }

    /*
      ---------------------------------------------------------
      Rendering
      ---------------------------------------------------------
    */
    function renderResults(rows, f, bounds) {
      iterations = rows;
      latestFunction = f;
      latestBounds = bounds;
      selectedStep = rows.length - 1;

      const finalRow = rows[rows.length - 1];

      finalRootEl.textContent = formatNumber(finalRow.xr, 3);
      iterationCountEl.textContent = rows.length;
      finalErrorEl.textContent =
        finalRow.error === null ? "—" : formatNumber(finalRow.error, 3);
      finalFxEl.textContent = formatNumber(finalRow.fxr, 3);

      rootBox.classList.add("show");
      statsGrid.classList.add("show");
      graphCard.classList.add("show");
      tableWrapper.classList.add("show");
      stepPanel.classList.add("show");
      emptyState.style.display = "none";

      renderTable();
      renderStep();
      drawGraph(f, bounds.xl, bounds.xu, finalRow.xr);
    }

    function renderTable() {
      resultBody.innerHTML = iterations
        .map((row, index) => {
          const activeClass = index === selectedStep ? "active-row" : "";

          return `
            <tr class="${activeClass}">
              <td>${row.iteration}</td>
              <td>${formatNumber(row.xl)}</td>
              <td>${formatNumber(row.xu)}</td>
              <td>${formatNumber(row.xr)}</td>
              <td>${formatNumber(row.fxr)}</td>
              <td>${row.error === null ? "—" : formatNumber(row.error)}</td>
            </tr>
          `;
        })
        .join("");
    }

    function renderStep() {
      if (!iterations.length) {
        stepText.textContent = "No iteration selected.";
        return;
      }

      const row = iterations[selectedStep];

      stepText.innerHTML = `
        <strong>Iteration ${row.iteration}</strong><br>
        xl = <strong>${formatNumber(row.xl)}</strong>,
        xu = <strong>${formatNumber(row.xu)}</strong>,
        xr = <strong>${formatNumber(row.xr)}</strong><br>
        f(xr) = <strong>${formatNumber(row.fxr)}</strong>,
        Error = <strong>${row.error === null ? "—" : formatNumber(row.error) + "%"}</strong>
      `;

      renderTable();

      if (latestFunction && latestBounds) {
        drawGraph(latestFunction, latestBounds.xl, latestBounds.xu, row.xr);
      }
    }

    function showMessage(text, type = "error") {
      messageBox.textContent = text;
      messageBox.className = `message ${type}`;
    }

    function clearMessage() {
      messageBox.textContent = "";
      messageBox.className = "message";
    }

    function clearResults() {
      iterations = [];
      selectedStep = 0;
      latestFunction = null;
      latestBounds = null;

      rootBox.classList.remove("show");
      statsGrid.classList.remove("show");
      graphCard.classList.remove("show");
      tableWrapper.classList.remove("show");
      stepPanel.classList.remove("show");
      emptyState.style.display = "block";
      resultBody.innerHTML = "";

      stopPlayback();
    }

    function formatNumber(value, digits = 3) {
      if (value === null || value === undefined) return "—";
      if (!Number.isFinite(value)) return String(value);

      const abs = Math.abs(value);

      if (abs !== 0 && (abs >= 1e7 || abs < 1e-5)) {
        return value.toExponential(6);
      }

      return Number(value.toFixed(digits)).toString();
    }

    /*
      ---------------------------------------------------------
      Canvas graph
      ---------------------------------------------------------
    */
    function drawGraph(f, xl, xu, root) {
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const width = rect.width;
      const height = rect.height;
      const padding = 45;

      ctx.clearRect(0, 0, width, height);

      if (xl === xu) return;

      const samples = [];
      const sampleCount = 600;

      for (let i = 0; i <= sampleCount; i++) {
        const x = xl + ((xu - xl) * i) / sampleCount;
        let y;

        try {
          y = f(x);
        } catch {
          y = NaN;
        }

        if (Number.isFinite(y)) {
          samples.push({ x, y });
        } else {
          samples.push({ x, y: null });
        }
      }

      const finiteValues = samples.filter(point => point.y !== null);

      if (!finiteValues.length) {
        drawCanvasMessage(ctx, width, height, "Graph unavailable for this interval.");
        return;
      }

      let yMin = Math.min(...finiteValues.map(point => point.y), 0);
      let yMax = Math.max(...finiteValues.map(point => point.y), 0);

      if (Math.abs(yMax - yMin) < 1e-12) {
        yMax += 1;
        yMin -= 1;
      }

      const yPadding = (yMax - yMin) * 0.12;
      yMin -= yPadding;
      yMax += yPadding;

      function toCanvasX(x) {
        return padding + ((x - xl) / (xu - xl)) * (width - 2 * padding);
      }

      function toCanvasY(y) {
        return height - padding - ((y - yMin) / (yMax - yMin)) * (height - 2 * padding);
      }

      // Background grid
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;

      for (let i = 0; i <= 10; i++) {
        const x = padding + (i / 10) * (width - 2 * padding);
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();

        const y = padding + (i / 10) * (height - 2 * padding);
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
      }

      // Axes
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.5;

      if (xl <= 0 && xu >= 0) {
        const axisX = toCanvasX(0);
        ctx.beginPath();
        ctx.moveTo(axisX, padding);
        ctx.lineTo(axisX, height - padding);
        ctx.stroke();
      }

      if (yMin <= 0 && yMax >= 0) {
        const axisY = toCanvasY(0);
        ctx.beginPath();
        ctx.moveTo(padding, axisY);
        ctx.lineTo(width - padding, axisY);
        ctx.stroke();
      }

      // Function curve
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      let started = false;

      for (const point of samples) {
        if (point.y === null) {
          started = false;
          continue;
        }

        const cx = toCanvasX(point.x);
        const cy = toCanvasY(point.y);

        if (!started) {
          ctx.moveTo(cx, cy);
          started = true;
        } else {
          ctx.lineTo(cx, cy);
        }
      }

      ctx.stroke();

      // Root marker
      if (Number.isFinite(root)) {
        const rootY = f(root);

        if (Number.isFinite(rootY)) {
          const cx = toCanvasX(root);
          const cy = toCanvasY(rootY);

          ctx.fillStyle = "#dc2626";
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#111827";
          ctx.font = "12px Segoe UI";
          ctx.fillText(`root ≈ ${formatNumber(root, 3)}`, cx + 10, cy - 10);
        }
      }

      // Labels
      ctx.fillStyle = "#475569";
      ctx.font = "12px Segoe UI";
      ctx.fillText(`xl = ${formatNumber(xl, 3)}`, padding, height - 14);
      ctx.fillText(`xu = ${formatNumber(xu, 3)}`, width - padding - 90, height - 14);
    }

    function drawCanvasMessage(ctx, width, height, message) {
      ctx.fillStyle = "#6b7280";
      ctx.font = "16px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(message, width / 2, height / 2);
      ctx.textAlign = "left";
    }

    /*
      ---------------------------------------------------------
      Event handlers
      ---------------------------------------------------------
    */
  // Submit handler now calls remoteSolve to offload numeric iterations to the backend.
  // It keeps compileExpression locally to produce the plotting function used by drawGraph.
  // The UI (table, graph, step controls) is unchanged — renderResults() is re-used as before.
  form.addEventListener("submit", async event => {
      event.preventDefault();
      clearMessage();
      stopPlayback();

      try {
        const equation = equationInput.value.trim();
        const method = methodInput.value;
  const xl = Number(xlInput.value);
  const xu = Number(xuInput.value);
  const x0 = x0Input ? Number(x0Input.value) : null;
        const eps = Number(epsInput.value);

        // Validate common inputs
        validateInputs({ equation, xl, xu, eps });

        // Additional validation for Newton, Secant and Fixed Point
        if (method === 'newton') {
          if (!Number.isFinite(x0)) throw new Error('Initial guess x0 must be provided for Newton method.');
        }
        if (method === 'secant') {
          const x1 = x1Input ? Number(x1Input.value) : NaN;
          if (!Number.isFinite(x0) || !Number.isFinite(x1)) throw new Error('Both initial guesses x0 and x1 must be provided for Secant method.');
        }
        if (method === 'fixed_point' || method === 'fixed-point') {
          if (!gInput || !gInput.value.trim()) throw new Error('Please provide g(x) for Fixed Point method.');
          if (!Number.isFinite(x0)) throw new Error('Initial guess x0 must be provided for Fixed Point method.');
        }

        // Keep local compileExpression for plotting only
        const f = compileExpression(equation);

        // Show a simple loading state
        showMessage("Solving on backend...", "success");

        // Disable form while solving
        Array.from(form.elements).forEach(el => el.disabled = true);

        const payload = {
          equation,
          method,
          tol: eps,
          max_iter: MAX_ITERATIONS,
        };

        if (method === 'newton') {
          payload.x0 = x0;
        } else if (method === 'secant') {
          payload.x0 = x0;
          payload.x1 = x1Input ? Number(x1Input.value) : x0;
        } else if (method === 'fixed_point' || method === 'fixed-point') {
          // For fixed-point we send g(x) as the equation string to the backend
          payload.equation = gInput.value.trim();
          payload.x0 = x0;
        } else {
          payload.xl = xl;
          payload.xu = xu;
          payload.x0 = (xl + xu) / 2;
        }

        const data = await remoteSolve(payload);

        // Re-enable form
        Array.from(form.elements).forEach(el => el.disabled = false);

        renderResults(data.rows, f, { xl, xu });

        const methodName = method === "bisection" ? "Bisection Method" : "False Position Method";
        showMessage(`${methodName} completed successfully.`, "success");
      } catch (error) {
        // Ensure form enabled
        Array.from(form.elements).forEach(el => el.disabled = false);
        clearResults();
        showMessage(error.message || "An unexpected error occurred.", "error");
      }
    });

    resetBtn.addEventListener("click", () => {
      equationInput.value = "4*x^3 - 6*x^2 + 7*x - 2.3";
      methodInput.value = "bisection";
      xlInput.value = "0";
      xuInput.value = "1";
      epsInput.value = "0.001";
      clearMessage();
      clearResults();
    });

    firstStepBtn.addEventListener("click", () => {
      selectedStep = 0;
      renderStep();
    });

    prevStepBtn.addEventListener("click", () => {
      if (selectedStep > 0) {
        selectedStep--;
        renderStep();
      }
    });

    nextStepBtn.addEventListener("click", () => {
      if (selectedStep < iterations.length - 1) {
        selectedStep++;
        renderStep();
      }
    });

    lastStepBtn.addEventListener("click", () => {
      selectedStep = iterations.length - 1;
      renderStep();
    });

    playBtn.addEventListener("click", () => {
      if (!iterations.length) return;

      if (playTimer) {
        stopPlayback();
        return;
      }

      playBtn.textContent = "Pause";

      playTimer = setInterval(() => {
        if (selectedStep >= iterations.length - 1) {
          stopPlayback();
          return;
        }

        selectedStep++;
        renderStep();
      }, 700);
    });

    window.addEventListener("resize", () => {
      if (latestFunction && latestBounds && iterations.length) {
        drawGraph(
          latestFunction,
          latestBounds.xl,
          latestBounds.xu,
          iterations[selectedStep].xr
        );
      }
    });

    function stopPlayback() {
      if (playTimer) {
        clearInterval(playTimer);
        playTimer = null;
      }

      playBtn.textContent = "Play";
    }

    function validateInputs({ equation, xl, xu, eps }) {
      if (!equation) {
        throw new Error("Please enter a mathematical equation.");
      }

      if (!Number.isFinite(xl)) {
        throw new Error("Please enter a valid lower bound xl.");
      }

      if (!Number.isFinite(xu)) {
        throw new Error("Please enter a valid upper bound xu.");
      }

      if (xl >= xu) {
        throw new Error("Lower bound xl must be less than upper bound xu.");
      }

      if (!Number.isFinite(eps) || eps <= 0) {
        throw new Error("Tolerance eps must be a positive number.");
      }
    }

// Optional dev helper: if the page URL contains ?auto_test=1 the form will submit
// automatically with the sample equation to speed manual verification.
try {
  const url = new URL(window.location.href);
  if (url.searchParams.get('auto_test') === '1') {
    // Small timeout to allow the page to finish wiring handlers
    setTimeout(() => {
      equationInput.value = 'x^3 - x - 2';
      methodInput.value = 'bisection';
      xlInput.value = '1';
      xuInput.value = '2';
      epsInput.value = '0.000001';
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }, 300);
  }
} catch (e) {
  // ignore URL parse errors in older browsers
}
