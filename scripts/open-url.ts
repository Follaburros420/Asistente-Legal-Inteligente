import { chromium } from 'playwright';

async function openUrl() {
  const url = 'https://aliado.pro/es/d43087ce-1282-4dcd-9785-5b528f1ba258/chat';

  console.log('Abriendo navegador...');
  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();
  await page.goto(url);

  console.log('URL abierta:', url);
  console.log('Presiona Ctrl+C para cerrar el navegador');

  // Mantener el navegador abierto
  await new Promise(() => {});
}

openUrl().catch(console.error);
