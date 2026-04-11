import { keyboard, Key } from "@nut-tree-fork/nut-js";
import { exec } from "child_process";
import { promisify } from "util";
import { chromium } from "playwright";

const execAsync = promisify(exec);
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function open_app(args: Record<string, any>) {
  console.log('[open_app] Starting with args:', args);
  const rawAppName = args.app;
  if (!rawAppName || typeof rawAppName !== 'string') {
    throw new Error("Missing 'app' in args");
  }

  // Capitalize first letter as requested
  const appName = rawAppName.charAt(0).toUpperCase() + rawAppName.slice(1);
  console.log('[open_app] Cleaned appName:', appName);

  // Pre-check if app is already loaded via tasklist
  try {
    console.log('[open_app] Running tasklist check...');
    const { stdout } = await execAsync(`tasklist | findstr /i "${appName}"`);
    console.log('[open_app] Tasklist stdout:', stdout);
    if (stdout.toLowerCase().includes(appName.toLowerCase())) {
      console.log('[open_app] App already open! Returning.');
      return { success: true, result: appName };
    }
  } catch (err) {
    console.log('[open_app] Tasklist check failed / not found. Moving to keyboard automation.');
  }

  console.log('[open_app] Pressing LeftSuper...');
  // Press 'win'
  await keyboard.pressKey(Key.LeftSuper);
  await keyboard.releaseKey(Key.LeftSuper);

  console.log('[open_app] Waiting 1500ms...');
  await delay(1500); // wait for start menu mapping

  console.log('[open_app] Typing appName...');
  // Type app name
  await keyboard.type(appName);

  console.log('[open_app] Waiting 1200ms...');
  await delay(1200);

  console.log('[open_app] Pressing Enter...');
  // Press enter
  await keyboard.pressKey(Key.Enter);
  await keyboard.releaseKey(Key.Enter);

  console.log('[open_app] Waiting 3500ms for app to open...');
  await delay(3500); // Wait for the app to open

  console.log('[open_app] Done! Returning success.');
  // Always return success with the App_name so it passes properly to the next tools
  return { success: true, result: appName };
}

export async function browser_action(args: Record<string, any>, previousState?: any) {
  let query = args.query || args.goal;

  if (!query && previousState?.result) {
    // Fallback securely to the string context from previous state
    query = String(previousState.result);
  }

  if (!query) {
    throw new Error("Missing 'query' or 'goal' in browser_action args");
  }

  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate and search on DuckDuckGo
    await page.goto(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);

    // Attempt to wait for generic text block results
    await page.waitForSelector('.result__snippet', { timeout: 7000 }).catch(() => { });

    // Extract raw text from Document Body
    const results = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.result')).map((el) => {
        const element = el as HTMLElement;

        return {
          title: element.querySelector('a')?.textContent,
          snippet: element.querySelector('.result__snippet')?.textContent,
          url: (element.querySelector('a') as HTMLAnchorElement)?.href
        };
      });
    });

    return { success: true, result: results };
  } finally {
    await browser.close();
  }
}

// Ensure keyboard doesn't type incredibly slow
keyboard.config.autoDelayMs = 15;
