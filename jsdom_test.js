const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const fetch = require('node-fetch');

(async () => {
  
  const root = path.resolve(__dirname, 'numarical_project');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
  const window = dom.window;
  global.window = window;
  global.document = window.document;
  global.fetch = fetch;
  // also attach fetch to the dom window so in-page scripts can call fetch
  dom.window.fetch = fetch;

  // load index.js into the jsdom environment
  const scriptSrc = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
  const scriptEl = dom.window.document.createElement('script');
  scriptEl.textContent = scriptSrc;
  dom.window.document.body.appendChild(scriptEl);

  // wait a bit for any async wiring
  await new Promise(r => setTimeout(r, 500));

  // populate form values
  dom.window.document.querySelector('#equation').value = 'x^3 - x - 2';
  dom.window.document.querySelector('#method').value = 'newton';
  dom.window.document.querySelector('#x0').value = '1.5';
  dom.window.document.querySelector('#eps').value = '0.000001';

  // submit (Newton)
  const payload = { equation: 'x^3 - x - 2', method: 'newton', x0: 1.5, tol: 0.000001, max_iter: 100 };
  try {
    const data = await dom.window.remoteSolve(payload);
    const f = dom.window.compileExpression(payload.equation);
    dom.window.renderResults(data.rows, f, { xl: payload.xl, xu: payload.xu });
  } catch (e) {
    console.error('remoteSolve failed:', e.message);
  }

  // wait for DOM updates
  await new Promise(r => setTimeout(r, 200));

  const rows = dom.window.document.querySelectorAll('#resultBody tr');
  console.log('Rows found:', rows.length);
  if (rows.length > 0) {
    console.log('First row text:', rows[0].textContent.trim());
  }
  process.exit(0);
})();
