const http = require('http');
const math = require('mathjs');

const PORT = 18080;
const MAX_ITERATIONS = 100;

function compileExpression(expr) {
  const compiled = math.compile(expr);
  return (x) => compiled.evaluate({ x });
}

function bisection(expr, a, b, tol, useFalsePosition) {
  const f = compileExpression(expr);
  const rows = [];

  let fa = f(a), fb = f(b);
  if (!isFinite(fa) || !isFinite(fb)) return { rows, converged: false, message: 'f(a) or f(b) is not finite' };
  if (fa * fb >= 0) return { rows, converged: false, message: 'Invalid interval' };

  let xrOld = NaN;
  for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
    let xr;
    if (!useFalsePosition) {
      xr = (a + b) / 2;
    } else {
      const f_a = f(a), f_b = f(b);
      const denom = f_a - f_b;
      if (Math.abs(denom) < Number.EPSILON) return { rows, converged: false, message: 'Denominator too small' };
      xr = b - (f_b * (a - b)) / denom;
    }

    const fxr = f(xr);
    let error = null;
    if (isFinite(xrOld)) {
      const denom = Math.abs(xr) > Number.EPSILON ? Math.abs(xr) : 1;
      error = Math.abs((xr - xrOld) / denom) * 100;
    }

    rows.push({ iteration: iter, xl: a, xu: b, xr, fxr, error: error !== null ? error : null });

    if (!isFinite(fxr)) return { rows, converged: false, message: 'f(xr) not finite' };
    if (fxr === 0) { rows[rows.length - 1].error = 0; return { rows, converged: true, message: 'Exact root' }; }
    if (f(a) * fxr < 0) b = xr; else a = xr;
    if (error !== null && error <= tol) return { rows, converged: true, message: 'Converged' };
    xrOld = xr;
  }
  return { rows, converged: false, message: 'Max iterations reached' };
}

function newton(expr, x0, tol) {
  const f = compileExpression(expr);
  const rows = [];
  const h = 1e-6;
  let x = x0;

  for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
    const fx = f(x);
    const fpx = (f(x + h) - f(x - h)) / (2 * h);

    rows.push({ iteration: iter, xl: x, xu: x, xr: x, fxr: fx, error: null });

    if (!isFinite(fx) || !isFinite(fpx)) return { rows, converged: false, message: 'Non-finite' };
    if (Math.abs(fpx) < 1e-15) return { rows, converged: false, message: 'Derivative too small' };

    const xNew = x - fx / fpx;
    const err = Math.abs((xNew - x) / (Math.abs(xNew) > 0 ? Math.abs(xNew) : 1)) * 100;

    if (err <= tol) {
      rows.push({ iteration: iter + 1, xl: xNew, xu: xNew, xr: xNew, fxr: f(xNew), error: err });
      return { rows, converged: true, message: 'Converged' };
    }
    x = xNew;
  }
  return { rows, converged: false, message: 'Max iterations reached' };
}

function secant(expr, x0, x1, tol) {
  const f = compileExpression(expr);
  const rows = [];

  let xPrev = x0, xCurr = x1;
  let fPrev = f(xPrev), fCurr = f(xCurr);

  if (!isFinite(fPrev) || !isFinite(fCurr)) return { rows, converged: false, message: 'Initial evaluations not finite' };

  for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
    if (Math.abs(fCurr - fPrev) < Number.EPSILON) return { rows, converged: false, message: 'Denominator too small' };

    const xNext = xCurr - fCurr * (xPrev - xCurr) / (fPrev - fCurr);
    const fNext = f(xNext);

    let error = null;
    if (isFinite(xCurr)) {
      const denom = Math.abs(xCurr) > Number.EPSILON ? Math.abs(xCurr) : 1;
      error = Math.abs((xNext - xCurr) / denom) * 100;
    }

    rows.push({ iteration: iter, xl: xPrev, xu: xCurr, xr: xNext, fxr: fNext, error: error !== null ? error : null });

    if (!isFinite(fNext)) return { rows, converged: false, message: 'f(x) not finite' };
    if (Math.abs(fNext) === 0) return { rows, converged: true, message: 'Exact root' };
    if (error !== null && error <= tol) return { rows, converged: true, message: 'Converged' };

    xPrev = xCurr; fPrev = fCurr;
    xCurr = xNext; fCurr = fNext;
  }
  return { rows, converged: false, message: 'Max iterations reached' };
}

function fixedPoint(expr, x0, tol) {
  const g = compileExpression(expr);
  const rows = [];
  let x = x0;

  for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
    const xNext = g(x);
    const fxr = isFinite(xNext) ? xNext - x : NaN;

    let error = null;
    if (isFinite(xNext)) {
      const denom = Math.abs(xNext) > Number.EPSILON ? Math.abs(xNext) : 1;
      error = Math.abs((xNext - x) / denom) * 100;
    }

    rows.push({ iteration: iter, xl: x, xu: x, xr: xNext, fxr: isFinite(fxr) ? fxr : null, error: error !== null ? error : null });

    if (!isFinite(xNext)) return { rows, converged: false, message: 'Non-finite g(x)' };
    if (error !== null && error <= tol) return { rows, converged: true, message: 'Converged' };
    x = xNext;
  }
  return { rows, converged: false, message: 'Max iterations reached' };
}

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer((req, res) => {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'running' }));
    return;
  }

  if (req.method === 'POST' && (req.url === '/api/solve' || req.url === '/api/bisection')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const j = JSON.parse(body);
        let result;

        if (req.url === '/api/solve') {
          const method = j.method;
          const equation = j.equation;
          const tol = j.tol || 1e-6;

          if (method === 'bisection') {
            const xl = j.xl, xu = j.xu;
            result = bisection(equation, xl, xu, tol, false);
          } else if (method === 'false-position' || method === 'false_position' || method === 'falseposition') {
            const xl = j.xl, xu = j.xu;
            result = bisection(equation, xl, xu, tol, true);
          } else if (method === 'newton') {
            result = newton(equation, j.x0, tol);
          } else if (method === 'secant') {
            result = secant(equation, j.x0, j.x1, tol);
          } else if (method === 'fixed_point' || method === 'fixed-point') {
            result = fixedPoint(equation, j.x0, tol);
          } else {
            res.writeHead(400);
            res.end('Unknown method');
            return;
          }
        } else {
          const equation = j.equation || '';
          const xl = j.a || j.xl || 0;
          const xu = j.b || j.xu || 0;
          const tol = j.tol || j.eps || 1e-6;
          result = bisection(equation, xl, xu, tol, false);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500);
        res.end('Server Error: ' + e.message);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Backend server running on http://127.0.0.1:${PORT}`);
});
