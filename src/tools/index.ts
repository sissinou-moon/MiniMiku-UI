import { keyboard, Key, clipboard } from "@nut-tree-fork/nut-js";
import { exec } from "child_process";
import { promisify } from "util";
import { chromium } from "playwright";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";


const execAsync = promisify(exec);
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

type StepType =
  | { type: "shortcut"; keys: string[] }
  | { type: "type"; useContent: boolean; value?: string }
  | { type: "paste"; useContent: boolean; value?: string }
  | { type: "wait"; ms: number }
  | { type: "enter" };

interface ActionFlow {
  steps: StepType[];
}

interface AppConfig {
  // Substrings to match against window titles (case-insensitive)
  windowTitleMatches: string[];
  actions: Record<string, ActionFlow>;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const appActionsRegistry: Record<string, AppConfig> = {
  obsidian: {
    windowTitleMatches: ["obsidian"],
    actions: {
      new_note: {
        steps: [
          { type: "shortcut", keys: ["ctrl", "n"] },
          { type: "wait", ms: 500 },
          // Obsidian goes straight to content area — no title step needed
        ],
      },
      insert_text: {
        steps: [{ type: "paste", useContent: true }],
      },
    },
  },

  word: {
    windowTitleMatches: ["word", "microsoft word"],
    actions: {
      new_document: {
        steps: [
          { type: "shortcut", keys: ["ctrl", "n"] },
          { type: "wait", ms: 800 },
        ],
      },
      paste_content: {
        steps: [
          { type: "paste", useContent: true },
        ],
      },
    },
  },

  notion: {
    windowTitleMatches: ["notion"],
    actions: {
      new_note: {
        steps: [
          { type: "shortcut", keys: ["ctrl", "n"] },
          { type: "wait", ms: 700 },
          // Notion focuses title first — type a short title, then move to body
          { type: "type", useContent: false, value: "New Note" },
          { type: "enter" },
          { type: "wait", ms: 400 },
        ],
      },
      insert_text: {
        steps: [{ type: "type", useContent: true }],
      },
    },
  },
};

// ─── Focus Helper ─────────────────────────────────────────────────────────────

async function focusApp(appName: string): Promise<boolean> {
  const config = appActionsRegistry[appName];
  if (!config) throw new Error(`App '${appName}' not found in registry`);

  // Build OR conditions for window title matching
  const titleConditions = config.windowTitleMatches
    .map((t) => `$w.MainWindowTitle -like '*${t}*'`)
    .join(" -or ");

  // Write script to a temp file — avoids heredoc inlining issues
  const psScript = [
    `$found = $false`,
    `foreach ($w in [System.Diagnostics.Process]::GetProcesses()) {`,
    `  if ($w.MainWindowHandle -ne 0 -and (${titleConditions})) {`,
    `    $hwnd = $w.MainWindowHandle`,
    `    Add-Type @"`,
    `      using System;`,
    `      using System.Runtime.InteropServices;`,
    `      public class WinFocus {`,
    `        [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);`,
    `        [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);`,
    `      }`,
    `"@`,
    `    [WinFocus]::ShowWindow($hwnd, 9)`,
    `    [WinFocus]::SetForegroundWindow($hwnd)`,
    `    $found = $true`,
    `    break`,
    `  }`,
    `}`,
    `if (-not $found) { exit 1 }`,
  ].join("\r\n");

  const tmpFile = join(tmpdir(), `focus_app_${Date.now()}.ps1`);
  try {
    writeFileSync(tmpFile, psScript, "utf8");
    await execAsync(`powershell -ExecutionPolicy Bypass -File "${tmpFile}"`);
    await delay(600);
    return true;
  } catch {
    console.warn(`[focusApp] Could not find/focus '${appName}' — app may not be running`);
    return false;
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }
  }
}

// ─── Step Executor ────────────────────────────────────────────────────────────

const keyMap: Record<string, Key> = {
  ctrl: Key.LeftControl,
  cmd: Key.LeftSuper,
  shift: Key.LeftShift,
  alt: Key.LeftAlt,
  n: Key.N,
  v: Key.V,
  c: Key.C,
  x: Key.X,
  z: Key.Z,
  a: Key.A,
  s: Key.S,
  enter: Key.Enter,
  tab: Key.Tab,
  escape: Key.Escape,
  space: Key.Space,
};

async function executeStep(step: StepType, content?: string): Promise<void> {
  switch (step.type) {

    case "shortcut": {
      const keys = step.keys.map((k) => {
        const mapped = keyMap[k.toLowerCase()];
        if (!mapped) throw new Error(`Unknown key: '${k}'`);
        return mapped;
      });
      // pressKey with spread holds all keys simultaneously (chord)
      await keyboard.pressKey(...keys);
      await keyboard.releaseKey(...[...keys].reverse());
      break;
    }

    case "type": {
      const text = step.useContent ? content : step.value;
      await keyboard.pressKey(Key.Enter);
      await keyboard.releaseKey(Key.Enter);
      await delay(300);
      if (text) await keyboard.type(text)
      break;
    }

    case "paste": {
      const text = step.useContent ? content : step.value;
      if (text) {
        await clipboard.setContent(text);
        await delay(300);
        await keyboard.pressKey(Key.Enter);
        await keyboard.releaseKey(Key.Enter);
        await keyboard.pressKey(Key.LeftControl, Key.V);
        await keyboard.releaseKey(Key.V, Key.LeftControl);
      }
      break;
    }

    case "enter": {
      await keyboard.pressKey(Key.Enter);
      await keyboard.releaseKey(Key.Enter);
      break;
    }

    case "wait": {
      await delay(step.ms);
      break;
    }
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function app_action(args: Record<string, any>) {
  console.log("[app_action] Starting with args:", args);

  const appName = (args.app as string)?.toLowerCase();
  const actionName = args.action as string;
  // Accept any common field name the LLM might use for content
  const content = (args.content ?? args.text ?? args.data ?? args.value) as string | undefined;

  if (!appName) throw new Error("Missing 'app' in args");
  if (!actionName) throw new Error("Missing 'action' in args");

  const appConfig = appActionsRegistry[appName];
  if (!appConfig) throw new Error(`App '${appName}' not found in registry`);

  const actionFlow = appConfig.actions[actionName];
  if (!actionFlow) throw new Error(`Action '${actionName}' not found for app '${appName}'`);

  // 1. Focus the app before doing anything
  const focused = await focusApp(appName);
  if (!focused) {
    // Log the warning but don't hard-fail — the app may still have focus
    console.warn(`[app_action] Could not focus '${appName}' via PS — proceeding anyway`);
  }

  // 2. Execute each step in the flow
  for (const step of actionFlow.steps) {
    console.log(`[app_action] Executing step:`, step);
    await executeStep(step, content);
    await delay(150); // Small buffer between steps
  }

  return { success: true, result: `Executed '${actionName}' on '${appName}'` };
}

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

    const isDirectUrl = typeof query === 'string' &&
      (query.startsWith('http') || query.startsWith('www.'));

    const targetUrl = isDirectUrl
      ? query
      : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;


    // Navigate and search on DuckDuckGo
    await page.goto(targetUrl);

    // Attempt to wait for generic text block results
    await page.waitForSelector('.result__snippet', { timeout: 7000 }).catch(() => { });

    // Extract raw text from Document Body
    const results = await page.evaluate(() => {

      function extractRealUrl(url: any) {
        try {
          const u = new URL(url);
          return decodeURIComponent(u.searchParams.get("uddg") || url);
        } catch {
          return url;
        }
      }

      function getDomain(url: any) {
        try {
          return new URL(url).hostname;
        } catch {
          return null;
        }
      }

      return Array.from(document.querySelectorAll('.result')).map((el, i) => {
        const link = el.querySelector('a');

        const rawUrl = link?.href || "";
        const url = extractRealUrl(rawUrl);

        return {
          rank: i + 1,

          // identity
          title: link?.textContent?.trim() || null,
          url,
          rawUrl,
          domain: getDomain(url),
          displayUrl: el.querySelector('.result__url')?.textContent?.trim() || null,

          // content
          snippet: el.querySelector('.result__snippet')?.textContent?.trim() || null,

          // enrichment signals
          badge: el.querySelector('.result__badge')?.textContent?.trim() || null,

          // sitelinks (VERY important)
          sitelinks: Array.from(el.querySelectorAll('.result__sitelink')).map(s => ({
            title: s.textContent?.trim(),
            url: s.baseURI
          })),

          // optional enrichment
          hasSitelinks: el.querySelectorAll('.result__sitelink').length > 0,

          // classification hint
          typeHint: (() => {
            const u = url.toLowerCase();
            if (u.includes("youtube.com")) return "youtube";
            if (u.includes("reddit.com")) return "reddit";
            if (u.includes("github.com")) return "github";
            if (u.includes("wikipedia.org")) return "wiki";
            return "web";
          })(),

          rawClass: el.className
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

export async function channel_youtube_videos(args: Record<string, any>) {
  const query = args.query || args.goal || 'JavaScript Tutorials';
  const browser = await chromium.launch({ headless: false });
  try {
    const page = await browser.newPage();

    // 1. Go to YouTube and Search
    await page.goto('https://www.youtube.com');
    await page.fill('input[name="search_query"]', query);
    await page.press('input[name="search_query"]', 'Enter');

    // 2. Choose the first channel from results
    const firstChannel = page.locator('ytd-channel-renderer').first();
    await firstChannel.locator('#main-link').click();

    // WAIT for channel page (IMPORTANT)
    await page.waitForURL(/youtube\.com\/(channel|@)/);

    // 3. Go to "Videos" tab
    await page.getByRole('tab', { name: 'Videos' }).click();
    await page.waitForSelector('ytd-rich-grid-media');

    // 4. Extract data from videos
    const videos = await page.locator('ytd-rich-grid-media').all();
    const data = [];

    for (const video of videos.slice(0, 5)) {
      const title = await video.locator('#video-title').innerText();

      const metadata = video.locator('#metadata-line span');

      const views = await metadata.nth(0).innerText();
      const date = await metadata.nth(1).innerText(); // ✅ upload date

      data.push({ title, views, date });
    }

    return { success: true, result: data };
  } catch (error: any) {
    return { success: false, result: error.message };
  } finally {
    await browser.close();
  }
}
