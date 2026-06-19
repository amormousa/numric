const http = require('http');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const PORT = 5500;
const ROOT = path.resolve(__dirname, 'numarical_project');

function serveFile(req, res) {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(ROOT, reqPath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      
      return;
    }
    let contentType = 'text/html';
    if (filePath.endsWith('.js')) contentType = 'application/javascript';
    if (filePath.endsWith('.css')) contentType = 'text/css';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

(async () => {
  const server = http.createServer(serveFile);
  server.listen(PORT);
  console.log('Static server running on', PORT, 'serving', ROOT);

  // Connect to an externally started Chrome instance using remote debugging.
  // Start Chrome with: --remote-debugging-port=9222 --user-data-dir=<dir>
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null, timeout: 60000 });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => logs.push({type: msg.type(), text: msg.text()}));
  page.on('pageerror', err => logs.push({type: 'pageerror', text: err.message}));

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle2', timeout: 60000 });

  // Fill form
  await page.evaluate(() => { document.querySelector('#equation').value = 'x^3 - x - 2'; document.querySelector('#method').value = 'bisection'; document.querySelector('#xl').value = '1'; document.querySelector('#xu').value = '2'; document.querySelector('#eps').value = '0.000001'; });

  // Submit and wait for /api/solve
  await Promise.all([
    page.click('button[type=submit]'),
    page.waitForResponse(resp => resp.url().includes('/api/solve') && resp.status() === 200, { timeout: 15000 })
  ]);

  // Wait for table rows
  await page.waitForSelector('#resultBody tr', { timeout: 15000 });

  const tableRows = await page.$$eval('#resultBody tr', trs => trs.map(tr => tr.innerText));
  console.log('Table rows count:', tableRows.length);

  // Collect messages and UI stats
  const iterCount = await page.$eval('#iterationCount', el => el.textContent);
  const finalRoot = await page.$eval('#finalRoot', el => el.textContent);

  console.log('iterationCount:', iterCount);
  console.log('finalRoot:', finalRoot);
  console.log('Console logs:', logs);

  await browser.close();
  server.close();
})();
