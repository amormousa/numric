const http = require('http');

const MAX_ITERATIONS = 100;

const FUNCTIONS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log,
  log: Math.log, log10: Math.log10, exp: Math.exp,
  floor: Math.floor, ceil: Math.ceil, round: Math.round
};

const CONSTANTS = { pi: Math.PI, e: Math.E };

function tokenize(expression) {
  const input = expression.replaceAll("−", "-").replaceAll("×", "*").replaceAll("÷", "/").trim();
  if (!input) throw new Error("Equation cannot be empty.");
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (/\s/.test(char)) { i++; continue; }
    if (/\d|\./.test(char)) {
      let start = i;
      let hasDot = false;
      while (i < input.length && /[\d.]/.test(input[i])) {
        if (input[i] === ".") { if (hasDot) throw new Error("Invalid number format."); hasDot = true; }
        i++;
      }
      if (i < input.length && /e/i.test(input[i]) && i + 1 < input.length && /[+\-\d]/.test(input[i + 1])) {
        i++;
        if (/[+\-]/.test(input[i])) i++;
        if (i >= input.length || !/\d/.test(input[i])) throw new Error("Invalid scientific notation.");
        while (i < input.length && /\d/.test(input[i])) i++;
      }
      const value = Number(input.slice(start, i));
      if (!Number.isFinite(value)) throw new Error("Invalid number in equation.");
      tokens.push({ type: "number", value });
      continue;
    }
    if (/[a-zA-Z_]/.test(char)) {
      let start = i;
      while (i < input.length && /[a-zA-Z_]/.test(input[i])) i++;
      const name = input.slice(start, i).toLowerCase();
      if (name === "x") tokens.push({ type: "variable" });
      else if (name in CONSTANTS) tokens.push({ type: "constant", value: CONSTANTS[name] });
      else if (name in FUNCTIONS) tokens.push({ type: "function", name });
      else throw new Error(`Unknown identifier "${name}".`);
      continue;
    }
    if ("+-*/^".includes(char)) { tokens.push({ type: "operator", value: char }); i++; continue; }
    if (char === "(") { tokens.push({ type: "leftParen" }); i++; continue; }
    if (char === ")") { tokens.push({ type: "rightParen" }); i++; continue; }
    throw new Error(`Invalid character "${char}" in equation.`);
  }
  return insertImplicitMultiplication(tokens);
}

function insertImplicitMultiplication(tokens) {
  const result = [];
  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    const previous = result[result.length - 1];
    if (previous && isValueToken(previous) && startsValueToken(current)) {
      result.push({ type: "operator", value: "*" });
    }
    result.push(current);
  }
  return result;
}

function isValueToken(token) {
  return token.type === "number" || token.type === "variable" || token.type === "constant" || token.type === "rightParen";
}

function startsValueToken(token) {
  return token.type === "number" || token.type === "variable" || token.type === "constant" || token.type === "function" || token.type === "leftParen";
}

function compileExpression(expression) {
  const tokens = tokenize(expression);
  let position = 0;
  function peek() { return tokens[position]; }
  function consume() { return tokens[position++]; }
  function matchOperator(operator) {
    const token = peek();
    if (token && token.type === "operator" && token.value === operator) { consume(); return true; }
    return false;
  }
  function parseExpression() {
    let left = parseTerm();
    while (true) {
      if (matchOperator("+")) { const right = parseTerm(); const l = left; left = x => l(x) + right(x); }
      else if (matchOperator("-")) { const right = parseTerm(); const l = left; left = x => l(x) - right(x); }
      else break;
    }
    return left;
  }
  function parseTerm() {
    let left = parseUnary();
    while (true) {
      if (matchOperator("*")) { const right = parseUnary(); const l = left; left = x => l(x) * right(x); }
      else if (matchOperator("/")) { const right = parseUnary(); const l = left; left = x => l(x) / right(x); }
      else break;
    }
    return left;
  }
  function parseUnary() {
    if (matchOperator("+")) return parseUnary();
    if (matchOperator("-")) { const operand = parseUnary(); return x => -operand(x); }
    return parsePower();
  }
  function parsePower() {
    let base = parsePrimary();
    if (matchOperator("^")) { const exponent = parseUnary(); const b = base; base = x => Math.pow(b(x), exponent(x)); }
    return base;
  }
  function parsePrimary() {
    const token = peek();
    if (!token) throw new Error("Unexpected end of equation.");
    if (token.type === "number") { consume(); return () => token.value; }
    if (token.type === "constant") { consume(); return () => token.value; }
    if (token.type === "variable") { consume(); return x => x; }
    if (token.type === "function") {
      consume();
      const functionName = token.name;
      const next = consume();
      if (!next || next.type !== "leftParen") throw new Error(`Function "${functionName}" must be followed by parentheses.`);
      const argument = parseExpression();
      const closing = consume();
      if (!closing || closing.type !== "rightParen") throw new Error(`Missing closing parenthesis after "${functionName}".`);
      return x => FUNCTIONS[functionName](argument(x));
    }
    if (token.type === "leftParen") {
      consume();
      const expression = parseExpression();
      const closing = consume();
      if (!closing || closing.type !== "rightParen") throw new Error("Missing closing parenthesis.");
      return expression;
    }
    throw new Error("Invalid equation syntax.");
  }
  const parsedFunction = parseExpression();
  if (position < tokens.length) throw new Error("Invalid equation syntax near the end of the expression.");
  return x => {
    const value = parsedFunction(x);
    if (typeof value !== "number" || Number.isNaN(value)) throw new Error("Equation produced an invalid numerical value.");
    return value;
  };
}

function numericalDerivative(f, x, h = 1e-7) {
  return (f(x + h) - f(x - h)) / (2 * h);
}

function solveEquation({ method, equation, xl, xu, x0, x1, gFunc, tol }) {
  const f = compileExpression(equation);
  const rows = [];
  let xrOld = null;

  if (method === "bisection" || method === "false-position" || method === "false_position" || method === "falseposition") {
    let a = xl, b = xu;
    let fa = f(a), fb = f(b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) throw new Error("f(xl) or f(xu) is not finite.");
    if (fa * fb >= 0) throw new Error(`Invalid interval: f(xl) × f(xu) must be less than 0. Current product is ${(fa * fb).toExponential(3)}.`);
    const useFalsePosition = method !== "bisection";

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      let xr;
      if (useFalsePosition) {
        xr = b - (fb * (a - b)) / (fa - fb);
      } else {
        xr = (a + b) / 2;
      }
      const fxr = f(xr);
      if (!Number.isFinite(fxr)) throw new Error(`f(xr) became non-finite at iteration ${iteration}.`);

      let error = null;
      if (xrOld !== null) {
        error = Math.abs((xr - xrOld) / (Math.abs(xr) > Number.EPSILON ? Math.abs(xr) : 1)) * 100;
      }

      rows.push({ iteration, xl: a, xu: b, xr, fxr, error });

      if (fxr === 0) { rows[rows.length - 1].error = 0; break; }
      if (fa * fxr < 0) { b = xr; fb = fxr; } else { a = xr; fa = fxr; }
      if (error !== null && error <= tol) break;
      xrOld = xr;
    }
  } else if (method === "newton") {
    let x = x0;
    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      const fx = f(x);
      const dfx = numericalDerivative(f, x);
      if (Math.abs(dfx) < 1e-15) throw new Error(`Derivative near zero at iteration ${iteration}. Newton method fails.`);
      const xNew = x - fx / dfx;
      let error = null;
      if (xrOld !== null) {
        error = Math.abs((xNew - x) / (Math.abs(xNew) > Number.EPSILON ? Math.abs(xNew) : 1)) * 100;
      }
      rows.push({ iteration, xl: x, xu: x, xr: xNew, fxr: f(xNew), error });
      if (Math.abs(f(xNew)) < 1e-15 || (error !== null && error <= tol)) break;
      xrOld = x;
      x = xNew;
    }
  } else if (method === "secant") {
    let xPrev = x0, xCurr = x1;
    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      const fPrev = f(xPrev), fCurr = f(xCurr);
      if (Math.abs(fCurr - fPrev) < 1e-15) throw new Error(`Division by near-zero at iteration ${iteration}. Secant method fails.`);
      const xNext = xCurr - fCurr * (xCurr - xPrev) / (fCurr - fPrev);
      let error = null;
      if (xrOld !== null) {
        error = Math.abs((xNext - xCurr) / (Math.abs(xNext) > Number.EPSILON ? Math.abs(xNext) : 1)) * 100;
      }
      rows.push({ iteration, xl: xPrev, xu: xCurr, xr: xNext, fxr: f(xNext), error });
      if (Math.abs(f(xNext)) < 1e-15 || (error !== null && error <= tol)) break;
      xrOld = xCurr;
      xPrev = xCurr;
      xCurr = xNext;
    }
  } else if (method === "fixed_point" || method === "fixed-point") {
    const g = compileExpression(gFunc || equation);
    let x = x0;
    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      const xNext = g(x);
      let error = null;
      if (xrOld !== null) {
        error = Math.abs((xNext - x) / (Math.abs(xNext) > Number.EPSILON ? Math.abs(xNext) : 1)) * 100;
      }
      rows.push({ iteration, xl: x, xu: x, xr: xNext, fxr: f(xNext), error });
      if (Math.abs(f(xNext)) < 1e-15 || (error !== null && error <= tol)) break;
      xrOld = x;
      x = xNext;
    }
  } else {
    throw new Error(`Unknown method: ${method}`);
  }

  return { rows };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/health') {
    return sendJSON(res, 200, { status: 'running' });
  }

  if (req.method === 'POST' && req.url === '/api/solve') {
    try {
      const j = await parseBody(req);
      if (!j.equation || !j.method) {
        return sendJSON(res, 400, { error: 'Missing equation or method' });
      }

      const method = j.method;
      const equation = j.equation;
      const tol = j.tol || 1e-6;
      const max_iter = j.max_iter || MAX_ITERATIONS;
      const xl = j.xl || 0;
      const xu = j.xu || 0;
      const x0 = j.x0;
      const x1 = j.x1;
      const gFunc = j.gfunc;

      const result = solveEquation({ method, equation, xl, xu, x0, x1, gFunc, tol });
      sendJSON(res, 200, result);
    } catch (ex) {
      sendJSON(res, 500, { error: `Server Error: ${ex.message}` });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/bisection') {
    try {
      const j = await parseBody(req);
      const equation = j.equation || '';
      const a = j.a ?? j.xl ?? 0;
      const b = j.b ?? j.xu ?? 0;
      const tol = j.tol ?? j.eps ?? 1e-6;
      const max_iter = j.max_iter ?? 100;

      const result = solveEquation({ method: 'bisection', equation, xl: a, xu: b, tol });
      sendJSON(res, 200, result);
    } catch (ex) {
      sendJSON(res, 500, { error: `Server Error: ${ex.message}` });
    }
    return;
  }

  sendJSON(res, 404, { error: 'Not found' });
});

const PORT = 18080;
server.listen(PORT, () => {
  console.log(`Numerical backend server running on http://127.0.0.1:${PORT}`);
});
