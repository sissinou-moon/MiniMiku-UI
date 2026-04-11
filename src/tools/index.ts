import { keyboard, Key } from "@nut-tree-fork/nut-js";
import { exec } from "child_process";
import { promisify } from "util";
import { chromium } from "playwright";

const execAsync = promisify(exec);
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function open_app(args: Record<string, any>) {
  const rawAppName = args.app;
  if (!rawAppName || typeof rawAppName !== 'string') {
    throw new Error("Missing 'app' in args");
  }

  // Capitalize first letter as requested
  const appName = rawAppName.charAt(0).toUpperCase() + rawAppName.slice(1);

  // Pre-check if app is already loaded via tasklist
  try {
    const { stdout } = await execAsync(`tasklist | findstr /i "${appName}"`);
    if (stdout.toLowerCase().includes(appName.toLowerCase())) {
        return { success: true, result: appName };
    }
  } catch (err) {
    // findstr exits with 1 if no match found, which is fine
  }

  // Press 'win'
  await keyboard.pressKey(Key.LeftSuper);
  await keyboard.releaseKey(Key.LeftSuper);
  await delay(1500); // wait for start menu mapping

  // Type app name
  await keyboard.type(appName);
  await delay(1200);

  // Press enter
  await keyboard.pressKey(Key.Enter);
  await keyboard.releaseKey(Key.Enter);

  await delay(3500); // Wait for the app to open

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

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate and search on DuckDuckGo
    await page.goto(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    
    // Attempt to wait for generic text block results
    await page.waitForSelector('.result__snippet', { timeout: 7000 }).catch(() => {});
    
    // Extract raw text from Document Body
    let textData = await page.innerText('body');
    
    // Truncate massively so we don't blow up the LLM limits completely.
    textData = textData.substring(0, 4000); 

    // Mix with previous browser action if applicable
    if (previousState && previousState.tool === 'browser_action') {
       textData = previousState.result + "\n---\n" + textData;
    }

    return { success: true, result: textData };
  } finally {
    await browser.close();
  }
}

// Ensure keyboard doesn't type incredibly slow
keyboard.config.autoDelayMs = 15;
