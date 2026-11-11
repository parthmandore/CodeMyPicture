/**
 * CodeMyPicture — Production IndexNow Protocol URL Submission CLI
 *
 * Submits canonical content URLs to the official IndexNow endpoint:
 * https://api.indexnow.org/indexnow
 *
 * Search engines notified: Bing, Yandex, Seznam, Naver (and other IndexNow participants).
 *
 * Features:
 * - Canonical key migration (Bing Webmaster Tools / IndexNow key: 39021b4cdb4a4e4b901469aa58f723e7)
 * - Safe multi-URL submission for genuine canonical pages
 * - Anti-spam deduplication caching (skips URLs submitted within last 24h unless --force)
 * - Dry-run validation mode (--dry-run)
 * - Comprehensive HTTP status logging and error diagnostics
 *
 * Usage:
 *   node scripts/submitIndexNow.js
 *   node scripts/submitIndexNow.js --dry-run
 *   node scripts/submitIndexNow.js --force
 *   node scripts/submitIndexNow.js --url https://codemypicture.netlify.app/
 */

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE = path.resolve(__dirname, '../.indexnow-submissions.json');

// Canonical configuration
const CONFIG = {
  host: 'codemypicture.netlify.app',
  key: '39021b4cdb4a4e4b901469aa58f723e7',
  keyLocation: 'https://codemypicture.netlify.app/39021b4cdb4a4e4b901469aa58f723e7.txt',
  // Genuine canonical content URLs (no query params, no fragments, no sitemaps, no asset files)
  canonicalUrls: [
    'https://codemypicture.netlify.app/',
    'https://codemypicture.netlify.app/image-to-svg/',
    'https://codemypicture.netlify.app/photo-to-vector/',
    'https://codemypicture.netlify.app/photo-to-painting/',
  ],
  dedupWindowMs: 24 * 60 * 60 * 1000, // 24 hours
};

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');

// Parse optional --url flags
let customUrls = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) {
    customUrls.push(args[i + 1]);
    i++;
  }
}

const targetUrls = customUrls.length > 0 ? customUrls : CONFIG.canonicalUrls;

/**
 * Validates payload schema according to IndexNow RFC specifications
 */
function validatePayload(host, key, keyLocation, urls) {
  if (!host || typeof host !== 'string' || host.includes('/') || host.includes(':')) {
    throw new Error(`Invalid host: "${host}". Must be pure hostname without protocol or port.`);
  }
  if (!key || !/^[a-f0-9]{32,128}$/i.test(key)) {
    throw new Error(`Invalid key format: "${key}". Must be 32 to 128 hexadecimal characters.`);
  }
  if (!keyLocation || !keyLocation.startsWith('https://')) {
    throw new Error(`Invalid keyLocation: "${keyLocation}". Must use HTTPS protocol.`);
  }
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error('urlList must contain at least one valid URL.');
  }

  for (const u of urls) {
    let parsed;
    try {
      parsed = new URL(u);
    } catch {
      throw new Error(`Malformed URL in urlList: "${u}"`);
    }
    if (parsed.protocol !== 'https:') {
      throw new Error(`Insecure protocol in "${u}". IndexNow requires HTTPS.`);
    }
    if (parsed.hostname !== host) {
      throw new Error(`Hostname mismatch in "${u}". Expected "${host}", got "${parsed.hostname}".`);
    }
    if (parsed.search || parsed.hash) {
      throw new Error(`URL "${u}" contains query parameters or hash fragments. Only clean canonical URLs permitted.`);
    }
  }
}

/**
 * Manages local submission cache to prevent duplicate requests within 24h
 */
function filterDuplicateUrls(urls, force) {
  if (force) return { toSubmit: urls, skipped: [] };

  let cache = {};
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch {
      cache = {};
    }
  }

  const now = Date.now();
  const toSubmit = [];
  const skipped = [];

  for (const url of urls) {
    const lastSubmitted = cache[url]?.timestamp || 0;
    if (now - lastSubmitted < CONFIG.dedupWindowMs) {
      skipped.push({ url, lastSubmitted: new Date(lastSubmitted).toISOString() });
    } else {
      toSubmit.push(url);
    }
  }

  return { toSubmit, skipped };
}

function updateSubmissionCache(urls, statusCode) {
  let cache = {};
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch {
      cache = {};
    }
  }

  const now = Date.now();
  for (const url of urls) {
    cache[url] = {
      timestamp: now,
      statusCode,
      keyUsed: CONFIG.key,
    };
  }

  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Cache Warning] Could not save submission cache:', err.message);
  }
}

async function run() {
  console.log('============================================================');
  console.log('CodeMyPicture // IndexNow Protocol URL Submission');
  console.log('============================================================');
  console.log(`Host:         ${CONFIG.host}`);
  console.log(`Key:          ${CONFIG.key}`);
  console.log(`KeyLocation:  ${CONFIG.keyLocation}`);
  console.log(`Execution:    ${isDryRun ? 'DRY-RUN (Simulated)' : 'PRODUCTION'}`);
  console.log(`Mode:         ${isForce ? 'FORCED (Bypassing 24h cache)' : 'DEDUPLICATED'}`);
  console.log('------------------------------------------------------------');

  // Verify local key file exists in public/
  const keyFilePath = path.resolve(__dirname, `../public/${CONFIG.key}.txt`);
  if (!fs.existsSync(keyFilePath)) {
    console.error(`❌ ERROR: Key file not found locally at: ${keyFilePath}`);
    console.error('Create public/${CONFIG.key}.txt containing the key before submitting.');
    process.exit(1);
  }
  const keyContent = fs.readFileSync(keyFilePath, 'utf8').trim();
  if (keyContent !== CONFIG.key) {
    console.error(`❌ ERROR: Key file content mismatch! Expected "${CONFIG.key}", found "${keyContent}"`);
    process.exit(1);
  }
  console.log(`✓ Local key file verified: public/${CONFIG.key}.txt matches key exactly.`);

  // Validate payload inputs
  try {
    validatePayload(CONFIG.host, CONFIG.key, CONFIG.keyLocation, targetUrls);
    console.log(`✓ Validated ${targetUrls.length} candidate URL(s).`);
  } catch (err) {
    console.error(`❌ Validation Failed: ${err.message}`);
    process.exit(1);
  }

  // Deduplication filtering
  const { toSubmit, skipped } = filterDuplicateUrls(targetUrls, isForce);
  if (skipped.length > 0) {
    console.log(`ℹ️ Skipped ${skipped.length} URL(s) previously submitted within 24h:`);
    for (const s of skipped) {
      console.log(`   - ${s.url} (Last submitted: ${s.lastSubmitted})`);
    }
  }

  if (toSubmit.length === 0) {
    console.log('\n✓ All URLs have been recently submitted. Nothing to send.');
    console.log('  Use --force to override deduplication if you published immediate changes.');
    return;
  }

  console.log(`\nSubmitting ${toSubmit.length} URL(s):`);
  for (const u of toSubmit) {
    console.log(`   → ${u}`);
  }

  const payload = JSON.stringify({
    host: CONFIG.host,
    key: CONFIG.key,
    keyLocation: CONFIG.keyLocation,
    urlList: toSubmit,
  });

  if (isDryRun) {
    console.log('\n[Dry-Run Notice] Payload constructed successfully. Request NOT sent to API.');
    console.log('Payload:', payload);
    return;
  }

  console.log('\nDispatching POST to https://api.indexnow.org/indexnow ...');

  const options = {
    hostname: 'api.indexnow.org',
    port: 443,
    path: '/indexnow',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      'User-Agent': 'CodeMyPicture-IndexNow-Agent/2.0',
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const statusCode = res.statusCode || 0;
        console.log(`\nResponse HTTP Status: ${statusCode}`);

        if (statusCode === 200) {
          console.log('✅ HTTP 200: URLs submitted successfully. Participating search engines will queue the pages.');
          updateSubmissionCache(toSubmit, statusCode);
          resolve({ success: true, statusCode });
        } else if (statusCode === 202) {
          console.log('✅ HTTP 202: URL submission received and accepted (queued for indexing).');
          updateSubmissionCache(toSubmit, statusCode);
          resolve({ success: true, statusCode });
        } else if (statusCode === 400) {
          console.error('❌ HTTP 400: Invalid request format or parameters.');
          console.error(data);
          resolve({ success: false, statusCode });
        } else if (statusCode === 403) {
          console.error('❌ HTTP 403: Forbidden — The key file is not accessible at keyLocation on the live host.');
          console.error('   Ensure public/${CONFIG.key}.txt is deployed and publicly returns HTTP 200.');
          console.error(data);
          resolve({ success: false, statusCode });
        } else if (statusCode === 422) {
          console.error('❌ HTTP 422: Unprocessable Entity — Submitted URL host does not match configured host.');
          console.error(data);
          resolve({ success: false, statusCode });
        } else if (statusCode === 429) {
          console.error('❌ HTTP 429: Rate Limited — Too many requests sent recently.');
          console.error(data);
          resolve({ success: false, statusCode });
        } else {
          console.log(`ℹ️ HTTP ${statusCode}: ${data || res.statusMessage}`);
          resolve({ success: statusCode >= 200 && statusCode < 300, statusCode });
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ Network Error:', e.message);
      reject(e);
    });

    req.write(payload);
    req.end();
  });
}

run().catch((err) => {
  console.error('[Fatal Error]:', err);
  process.exit(1);
});
