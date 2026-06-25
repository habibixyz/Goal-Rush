const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => {
    errors.push('PageError: ' + err.message);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push('ConsoleError: ' + msg.text());
    }
  });

  await page.goto('http://localhost:5175', { waitUntil: 'networkidle2' });
  
  console.log("ERRORS FOUND:");
  console.log(errors.join('\n'));
  
  await browser.close();
})();
