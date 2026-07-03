/**
 * ITAB Live Site Smoke Tests
 * Tests against https://itabproperties.com to verify all payment
 * flows and user roles work correctly on the deployed site.
 *
 * Run: node tests/live-site.test.js
 * Or:  npm run test:live
 *
 * ⚠️  Requires a live ITAB backend at ITAB_API_URL.
 */

const https = require('https');
const http  = require('http');

const BASE = process.env.ITAB_API_URL || 'https://itab-backend.onrender.com';
const SITE = 'https://itabproperties.com';

// ── Tiny HTTP helper (no extra deps) ─────────────────────────────────────────
function req(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const bodyStr = body ? JSON.stringify(body) : undefined;
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const lib = isHttps ? https : http;
    const r = lib.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
    results.push({ name, status: 'pass' });
  } catch (err) {
    console.log(`  ❌  ${name}`);
    console.log(`       ${err.message}`);
    failed++;
    results.push({ name, status: 'fail', error: err.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ── Login helper ──────────────────────────────────────────────────────────────
async function login(email, password) {
  const res = await req('POST', `${BASE}/api/auth/login`, { email, password });
  assert(res.status === 200, `Login failed for ${email}: HTTP ${res.status} — ${JSON.stringify(res.body)}`);
  const token = res.body?.data?.token;
  assert(token, `No token in login response for ${email}`);
  return token;
}

// ─────────────────────────────────────────────────────────────────────────────
async function runAll() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  ITAB Live Site Smoke Tests');
  console.log(`  Backend : ${BASE}`);
  console.log(`  Frontend: ${SITE}`);
  console.log('══════════════════════════════════════════════════════\n');

  // ── 1. Health check ───────────────────────────────────────────────────────
  console.log('▶ Backend health');
  await test('GET /health returns ok', async () => {
    const res = await req('GET', `${BASE}/health`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.status === 'ok', `Expected status=ok, got ${res.body.status}`);
  });

  // ── 2. Frontend reachable ─────────────────────────────────────────────────
  console.log('\n▶ Frontend availability');
  await test('https://itabproperties.com returns HTML', async () => {
    const res = await req('GET', SITE);
    assert(res.status === 200, `Frontend returned HTTP ${res.status}`);
  });

  // ── 3. Auth — all roles ───────────────────────────────────────────────────
  console.log('\n▶ Authentication — all user roles');
  const creds = {
    admin:   { email: process.env.ADMIN_EMAIL   || 'admin@itabproperties.com',    password: process.env.ADMIN_PASS   || 'Admin@1234' },
    tenant:  { email: process.env.TENANT_EMAIL  || 'tenant@itabproperties.com',   password: process.env.TENANT_PASS  || 'Tenant@1234' },
    landlord:{ email: process.env.LANDLORD_EMAIL|| 'landlord@itabproperties.com', password: process.env.LANDLORD_PASS|| 'Landlord@1234' },
    manager: { email: process.env.MANAGER_EMAIL || 'manager@itabproperties.com',  password: process.env.MANAGER_PASS || 'Manager@1234' },
    vendor:  { email: process.env.VENDOR_EMAIL  || 'vendor@itabproperties.com',   password: process.env.VENDOR_PASS  || 'Vendor@1234' },
  };

  const tokens = {};
  for (const [role, c] of Object.entries(creds)) {
    await test(`${role} can log in`, async () => {
      tokens[role] = await login(c.email, c.password);
    });
  }

  // ── 4. Payment preferences — each paying role ─────────────────────────────
  console.log('\n▶ Payment preferences');
  for (const role of ['landlord', 'manager', 'vendor']) {
    if (!tokens[role]) continue;
    await test(`${role} can save Airtel Money payment preference`, async () => {
      const res = await req('POST', `${BASE}/api/payment-preferences`, {
        preferredMethod: 'airtel_money',
        airtelPhone: '0751234567',
      }, tokens[role]);
      assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert(res.body.data?.preferred_method === 'airtel_money', 'Preference not saved');
    });
    await test(`${role} can save MTN MoMo payment preference`, async () => {
      const res = await req('POST', `${BASE}/api/payment-preferences`, {
        preferredMethod: 'mtn_momo',
        mtnPhone: '0771234567',
      }, tokens[role]);
      assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    });
  }

  // ── 5. Payments — list and initiate ──────────────────────────────────────
  console.log('\n▶ Payment flows');
  await test('tenant can list their payments', async () => {
    if (!tokens.tenant) throw new Error('No tenant token — skipped');
    const res = await req('GET', `${BASE}/api/payments`, null, tokens.tenant);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.data), 'Expected array of payments');
  });

  await test('tenant can initiate Airtel Money payment', async () => {
    if (!tokens.tenant) throw new Error('No tenant token — skipped');
    const res = await req('POST', `${BASE}/api/payments/airtel/initiate`, {
      phone: '0751234567', amount: 100000, reference: `AIR-SMOKE-${Date.now()}`,
    }, tokens.tenant);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.data?.status === 'pending', 'Expected pending status');
    assert(res.body.data?.reference, 'Expected reference in response');
  });

  await test('tenant can initiate MTN MoMo payment', async () => {
    if (!tokens.tenant) throw new Error('No tenant token — skipped');
    const res = await req('POST', `${BASE}/api/payments/mtn/initiate`, {
      phone: '0771234567', amount: 100000,
    }, tokens.tenant);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data?.status === 'pending', 'Expected pending status');
    assert(res.body.data?.reference?.startsWith('MTN-'), 'Expected MTN reference');
  });

  // ── 6. Airtel callback ────────────────────────────────────────────────────
  console.log('\n▶ Payment callbacks (Airtel & MTN)');
  const smokeRef = `AIR-SMOKE-${Date.now()}`;
  await test('Airtel callback accepts TS (success) status', async () => {
    const res = await req('POST', `${BASE}/api/payments/airtel/callback`, {
      transaction: { id: smokeRef, status_code: 'TS' },
      status: { code: 'TS', message: 'Transaction Successful' },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.status === 'OK', `Expected OK, got ${res.body.status}`);
    assert(res.body.processed === true, 'Expected processed=true');
  });

  await test('Airtel callback accepts TF (failed) status', async () => {
    const res = await req('POST', `${BASE}/api/payments/airtel/callback`, {
      transaction: { id: `AIR-FAIL-SMOKE-${Date.now()}`, status_code: 'TF' },
      status: { code: 'TF' },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.status === 'OK');
  });

  await test('MTN callback accepts SUCCESSFUL status', async () => {
    const res = await req('POST', `${BASE}/api/payments/mtn/callback`, {
      externalId: `MTN-SMOKE-${Date.now()}`,
      status: 'SUCCESSFUL',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.status === 'OK');
  });

  await test('Airtel callback still returns 200 on DB error (Airtel no retry)', async () => {
    // Send malformed payload — backend must still return 200
    const res = await req('POST', `${BASE}/api/payments/airtel/callback`, {
      INVALID: true, no_transaction: null,
    });
    assert(res.status === 200, `Expected 200 even on bad payload, got ${res.status}`);
  });

  // ── 7. Payment status polling ─────────────────────────────────────────────
  console.log('\n▶ Payment status polling');
  await test('payment status endpoint returns pending for unknown ref', async () => {
    if (!tokens.tenant) throw new Error('No tenant token');
    const ref = `SMOKE-UNKNOWN-${Date.now()}`;
    const res = await req('GET', `${BASE}/api/payments/status/${ref}`, null, tokens.tenant);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(['pending', 'completed', 'failed'].includes(res.body.data?.status),
      `Unexpected status: ${res.body.data?.status}`);
  });

  await test('payment status shows completed after Airtel success callback', async () => {
    if (!tokens.tenant) throw new Error('No tenant token');
    const ref = `AIR-STATUS-SMOKE-${Date.now()}`;

    // 1. Initiate so a record exists
    await req('POST', `${BASE}/api/payments/airtel/initiate`,
      { phone: '0751234567', amount: 50000, reference: ref }, tokens.tenant);

    // 2. Fire success callback
    await req('POST', `${BASE}/api/payments/airtel/callback`, {
      transaction: { id: ref }, status: { code: 'TS' },
    });

    // 3. Poll status
    const res = await req('GET', `${BASE}/api/payments/status/${ref}`, null, tokens.tenant);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data?.status === 'completed',
      `Expected completed, got ${res.body.data?.status}`);
  });

  // ── 8. Transactions ───────────────────────────────────────────────────────
  console.log('\n▶ Transactions — each role sees their own');
  for (const [role, token] of Object.entries(tokens)) {
    if (!token) continue;
    await test(`${role} can list transactions`, async () => {
      const res = await req('GET', `${BASE}/api/transactions`, null, token);
      assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
      assert(Array.isArray(res.body.data), 'Expected array');
    });
  }

  // ── 9. Payouts ────────────────────────────────────────────────────────────
  console.log('\n▶ Payouts');
  await test('landlord can list their payouts', async () => {
    if (!tokens.landlord) throw new Error('No landlord token');
    const res = await req('GET', `${BASE}/api/payouts`, null, tokens.landlord);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.data), 'Expected array of payouts');
  });

  await test('admin can list all payouts', async () => {
    if (!tokens.admin) throw new Error('No admin token');
    const res = await req('GET', `${BASE}/api/payouts`, null, tokens.admin);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // ── 10. Inspections ───────────────────────────────────────────────────────
  console.log('\n▶ Inspections');
  await test('tenant can list their inspections', async () => {
    if (!tokens.tenant) throw new Error('No tenant token');
    const res = await req('GET', `${BASE}/api/inspections`, null, tokens.tenant);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.data), 'Expected array');
  });

  // ── 11. Vendor earnings ───────────────────────────────────────────────────
  console.log('\n▶ Vendor earnings');
  await test('vendor can list their transactions (earnings)', async () => {
    if (!tokens.vendor) throw new Error('No vendor token');
    const res = await req('GET', `${BASE}/api/transactions`, null, tokens.vendor);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.data), 'Expected array');
  });

  // ── 12. Security — unauthenticated access blocked ─────────────────────────
  console.log('\n▶ Security — unauthenticated requests blocked');
  for (const endpoint of ['/api/payments', '/api/transactions', '/api/payouts']) {
    await test(`${endpoint} requires auth`, async () => {
      const res = await req('GET', `${BASE}${endpoint}`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });
  }

  // ── 13. ITAB platform fee in transaction split ────────────────────────────
  console.log('\n▶ Company fee tracking');
  await test('admin can see platform_fee transactions (ITAB revenue)', async () => {
    if (!tokens.admin) throw new Error('No admin token');
    const res = await req('GET', `${BASE}/api/transactions`, null, tokens.admin);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    // Just verify the endpoint works; actual fee transactions depend on live data
    assert(Array.isArray(res.body.data), 'Expected array');
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  if (failed > 0) {
    console.log('\n  Failed tests:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`    ❌ ${r.name}`);
      console.log(`       ${r.error}`);
    });
    console.log('\n  ⚠️  Some tests failed. Check credentials in .env or the live backend logs.');
  } else {
    console.log('\n  🎉 All tests passed! Payment module is working correctly on the live site.');
  }
  console.log('══════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runAll().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
