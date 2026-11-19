'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Extract pure helper classes/functions directly from scraper.js so tests verify the exact production code
// without starting Firebase, cron, or Puppeteer.
function loadScraperHelpers() {
    const src = fs.readFileSync(path.join(__dirname, 'scraper.js'), 'utf8');

    const extractBlock = (startMarker, endMarker) => {
        const start = src.indexOf(startMarker);
        const end = src.indexOf(endMarker, start);
        assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
        assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
        return src.slice(start, end);
    };

    const proxyBlock = extractBlock('function parseProxyString(raw) {', 'const proxyManager = new ProxyManager();');
    const jsonBlock = extractBlock('function repairMalformedJson(raw) {', 'async function checkImageCleanWithGemini(');
    const sleepBlock = extractBlock('async function sleepWithAbort(ms, signal = null) {', 'async function processWithGemini(');

    const sandbox = {
        process: { env: {} },
        console: { log: () => {}, warn: () => {}, error: () => {} },
        URL,
        Map,
        Date,
        Math,
        Infinity,
        setTimeout,
        clearTimeout,
        Promise,
        Error
    };
    vm.createContext(sandbox);
    vm.runInContext(`${proxyBlock}\n${jsonBlock}\n${sleepBlock}\nthis.ProxyManager = ProxyManager;`, sandbox);
    return sandbox;
}

const helpers = loadScraperHelpers();

test('parseAIJson repairs bare minus sign in JSON value (fixes "No number after minus sign" error)', () => {
    const broken = '{"isRelevant": true, "qualityScore": -, "headline": "తెలుగు వార్త", "tags": ["news",]}';
    const parsed = helpers.parseAIJson(broken);
    assert.equal(parsed.isRelevant, true);
    assert.equal(parsed.qualityScore, 0);
    assert.equal(parsed.headline, 'తెలుగు వార్త');
    assert.deepEqual(Array.from(parsed.tags), ['news']);
});

test('parseAIJson repairs unescaped raw newlines inside string literals', () => {
    const broken = '```json\n{"headline": "హైదరాబాద్\nవర్షాలు", "qualityScore": 8.2}\n```';
    const parsed = helpers.parseAIJson(broken);
    assert.equal(parsed.headline, 'హైదరాబాద్\nవర్షాలు');
    assert.equal(parsed.qualityScore, 8.2);
});

test('parseAIJson preserves valid negative numbers untouched', () => {
    const valid = '{"delta": -3.5, "headline": "ఉష్ణోగ్రతలు -2 డిగ్రీలకు పడిపోయాయి"}';
    const parsed = helpers.parseAIJson(valid);
    assert.equal(parsed.delta, -3.5);
    assert.equal(parsed.headline, 'ఉష్ణోగ్రతలు -2 డిగ్రీలకు పడిపోయాయి');
});

test('parseAIJson throws diagnostic snippet on genuinely truncated JSON', () => {
    assert.throws(
        () => helpers.parseAIJson('{"headline": "test", "qualityScore": -abc}'),
        /No number after minus sign|near:/
    );
});

test('ProxyManager tracks healthy count and earliest cooldown wait accurately', () => {
    helpers.process.env.WEBSHARE_PROXIES = '1.1.1.1:8000:u:p,2.2.2.2:8000:u:p';
    const pm = new helpers.ProxyManager();
    assert.equal(pm.getProxyCount(), 2);
    assert.equal(pm.getHealthyProxyCount(), 2);
    assert.equal(pm.getEarliestCooldownWaitMs(), 0);

    const p1 = pm.getNextProxy({ onlyHealthy: true });
    const p2 = pm.getNextProxy({ onlyHealthy: true });
    assert.notEqual(p1, p2);

    pm.markCooldownProxy(p1, 10000, '429');
    assert.equal(pm.getHealthyProxyCount(), 1);
    assert.equal(pm.getEarliestCooldownWaitMs(), 0);

    pm.markCooldownProxy(p2, 5000, '429');
    assert.equal(pm.getHealthyProxyCount(), 0);
    assert.equal(pm.getNextProxy({ onlyHealthy: true }), null);

    const waitMs = pm.getEarliestCooldownWaitMs();
    assert.ok(waitMs > 3000 && waitMs <= 5000, `Expected waitMs near 5000ms, got ${waitMs}`);
});

test('sleepWithAbort resolves immediately when aborted', async () => {
    const controller = new AbortController();
    const start = Date.now();
    setTimeout(() => controller.abort(), 30);
    await helpers.sleepWithAbort(10000, controller.signal);
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 500, `Expected early abort resolution, took ${elapsed}ms`);
});
