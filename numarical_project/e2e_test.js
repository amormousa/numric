const http = require('http');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const PORT = 5500;
const ROOT = path.resolve(__dirname);

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
    res.writeHead(200);
    res.end(data);
  });
}

(async () => {
  const server = http.createServer(serveFile);
  server.listen(PORT);
  console.log('Static server running on', PORT);

  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
    timeout: 30000
  });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => logs.push({type: msg.type(), text: msg.text()}));

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle2' });

  // Fill form
  await page.type('#equation', 'x^3 - x - 2');
  await page.select('#method', 'bisection');
  await page.click('#xl');
  await page.evaluate(() => document.querySelector('#xl').value = '1');
  await page.evaluate(() => document.querySelector('#xu').value = '2');
  await page.evaluate(() => document.querySelector('#eps').value = '0.000001');

  // Submit
  await Promise.all([
    page.click('button[type=submit]'),
    page.waitForResponse(resp => resp.url().includes('/api/solve') && resp.status() === 200, { timeout: 5000 })
  ]);

  // Wait for table to update
  await page.waitForSelector('#resultBody tr', { timeout: 5000 });

  const tableRows = await page.$$eval('#resultBody tr', trs => trs.map(tr => tr.innerText));
  console.log('Table rows count:', tableRows.length);

  // Check console logs
  console.log('Console logs:', logs);

  await browser.close();
  server.close();
})();
