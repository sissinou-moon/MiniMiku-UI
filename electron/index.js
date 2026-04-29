"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appActionsRegistry = void 0;
exports.app_action = app_action;
exports.open_app = open_app;
exports.browser_action = browser_action;
exports.channel_youtube_videos = channel_youtube_videos;
const nut_js_1 = require("@nut-tree-fork/nut-js");
const child_process_1 = require("child_process");
const util_1 = require("util");
const playwright_1 = require("playwright");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const delay = (ms) => new Promise(r => setTimeout(r, ms));
// ─── Registry ─────────────────────────────────────────────────────────────────
exports.appActionsRegistry = {
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
async function focusApp(appName) {
    const config = exports.appActionsRegistry[appName];
    if (!config)
        throw new Error(`App '${appName}' not found in registry`);
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
    const tmpFile = (0, path_1.join)((0, os_1.tmpdir)(), `focus_app_${Date.now()}.ps1`);
    try {
        (0, fs_1.writeFileSync)(tmpFile, psScript, "utf8");
        await execAsync(`powershell -ExecutionPolicy Bypass -File "${tmpFile}"`);
        await delay(600);
        return true;
    }
    catch {
        console.warn(`[focusApp] Could not find/focus '${appName}' — app may not be running`);
        return false;
    }
    finally {
        try {
            (0, fs_1.unlinkSync)(tmpFile);
        }
        catch { /* ignore cleanup errors */ }
    }
}
// ─── Step Executor ────────────────────────────────────────────────────────────
const keyMap = {
    ctrl: nut_js_1.Key.LeftControl,
    cmd: nut_js_1.Key.LeftSuper,
    shift: nut_js_1.Key.LeftShift,
    alt: nut_js_1.Key.LeftAlt,
    n: nut_js_1.Key.N,
    v: nut_js_1.Key.V,
    c: nut_js_1.Key.C,
    x: nut_js_1.Key.X,
    z: nut_js_1.Key.Z,
    a: nut_js_1.Key.A,
    s: nut_js_1.Key.S,
    enter: nut_js_1.Key.Enter,
    tab: nut_js_1.Key.Tab,
    escape: nut_js_1.Key.Escape,
    space: nut_js_1.Key.Space,
};
async function executeStep(step, content) {
    switch (step.type) {
        case "shortcut": {
            const keys = step.keys.map((k) => {
                const mapped = keyMap[k.toLowerCase()];
                if (!mapped)
                    throw new Error(`Unknown key: '${k}'`);
                return mapped;
            });
            // pressKey with spread holds all keys simultaneously (chord)
            await nut_js_1.keyboard.pressKey(...keys);
            await nut_js_1.keyboard.releaseKey(...[...keys].reverse());
            break;
        }
        case "type": {
            const text = step.useContent ? content : step.value;
            await nut_js_1.keyboard.pressKey(nut_js_1.Key.Enter);
            await nut_js_1.keyboard.releaseKey(nut_js_1.Key.Enter);
            await delay(300);
            if (text)
                await nut_js_1.keyboard.type(text);
            break;
        }
        case "paste": {
            const text = step.useContent ? content : step.value;
            if (text) {
                await nut_js_1.clipboard.setContent(text);
                await delay(300);
                await nut_js_1.keyboard.pressKey(nut_js_1.Key.Enter);
                await nut_js_1.keyboard.releaseKey(nut_js_1.Key.Enter);
                await nut_js_1.keyboard.pressKey(nut_js_1.Key.LeftControl, nut_js_1.Key.V);
                await nut_js_1.keyboard.releaseKey(nut_js_1.Key.V, nut_js_1.Key.LeftControl);
            }
            break;
        }
        case "enter": {
            await nut_js_1.keyboard.pressKey(nut_js_1.Key.Enter);
            await nut_js_1.keyboard.releaseKey(nut_js_1.Key.Enter);
            break;
        }
        case "wait": {
            await delay(step.ms);
            break;
        }
    }
}
// ─── Main Entry Point ─────────────────────────────────────────────────────────
async function app_action(args) {
    console.log("[app_action] Starting with args:", args);
    const appName = args.app?.toLowerCase();
    const actionName = args.action;
    // Accept any common field name the LLM might use for content
    const content = (args.content ?? args.text ?? args.data ?? args.value);
    if (!appName)
        throw new Error("Missing 'app' in args");
    if (!actionName)
        throw new Error("Missing 'action' in args");
    const appConfig = exports.appActionsRegistry[appName];
    if (!appConfig)
        throw new Error(`App '${appName}' not found in registry`);
    const actionFlow = appConfig.actions[actionName];
    if (!actionFlow)
        throw new Error(`Action '${actionName}' not found for app '${appName}'`);
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
async function open_app(args) {
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
    }
    catch (err) {
        console.log('[open_app] Tasklist check failed / not found. Moving to keyboard automation.');
    }
    console.log('[open_app] Pressing LeftSuper...');
    // Press 'win'
    await nut_js_1.keyboard.pressKey(nut_js_1.Key.LeftSuper);
    await nut_js_1.keyboard.releaseKey(nut_js_1.Key.LeftSuper);
    console.log('[open_app] Waiting 1500ms...');
    await delay(1500); // wait for start menu mapping
    console.log('[open_app] Typing appName...');
    // Type app name
    await nut_js_1.keyboard.type(appName);
    console.log('[open_app] Waiting 1200ms...');
    await delay(1200);
    console.log('[open_app] Pressing Enter...');
    // Press enter
    await nut_js_1.keyboard.pressKey(nut_js_1.Key.Enter);
    await nut_js_1.keyboard.releaseKey(nut_js_1.Key.Enter);
    console.log('[open_app] Waiting 3500ms for app to open...');
    await delay(3500); // Wait for the app to open
    console.log('[open_app] Done! Returning success.');
    // Always return success with the App_name so it passes properly to the next tools
    return { success: true, result: appName };
}
async function browser_action(args, previousState) {
    let query = args.query || args.goal;
    if (!query && previousState?.result) {
        // Fallback securely to the string context from previous state
        query = String(previousState.result);
    }
    if (!query) {
        throw new Error("Missing 'query' or 'goal' in browser_action args");
    }
    const browser = await playwright_1.chromium.launch({ headless: false });
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
            function extractRealUrl(url) {
                try {
                    const u = new URL(url);
                    return decodeURIComponent(u.searchParams.get("uddg") || url);
                }
                catch {
                    return url;
                }
            }
            function getDomain(url) {
                try {
                    return new URL(url).hostname;
                }
                catch {
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
                        if (u.includes("youtube.com"))
                            return "youtube";
                        if (u.includes("reddit.com"))
                            return "reddit";
                        if (u.includes("github.com"))
                            return "github";
                        if (u.includes("wikipedia.org"))
                            return "wiki";
                        return "web";
                    })(),
                    rawClass: el.className
                };
            });
        });
        return { success: true, result: results };
    }
    finally {
        await browser.close();
    }
}
// Ensure keyboard doesn't type incredibly slow
nut_js_1.keyboard.config.autoDelayMs = 15;
async function channel_youtube_videos(args) {
    const query = args.query || args.goal || 'JavaScript Tutorials';
    const browser = await playwright_1.chromium.launch({ headless: false });
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
    }
    catch (error) {
        return { success: false, result: error.message };
    }
    finally {
        await browser.close();
    }
}
