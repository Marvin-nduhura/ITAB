/**
 * ITAB Payment Module Tests
 * Tests all payment flows: Airtel callback, MTN callback, rent payment,
 * inspection fee, payouts, transactions, payment preferences, status polling.
 *
 * Uses supertest — no live DB needed (mocks pool.query).
 */

const request = require('supertest');

// ── Mock pg Pool before requiring server ─────────────────────────────────────
const mockQuery = jest.fn();
jest.mock('pg', () => {
  return {
    Pool: jest.fn().mockImplementation(() => ({
      query: mockQuery,
    })),
  };
});

// Mock dotenv so missing .env doesn't throw
jest.mock('dotenv', () => ({ config: jest.fn() }));

let app;
beforeAll(() => {
  process.env.JWT_SECRET = 'test_secret_itab';
  process.env.NODE_ENV   = 'test';
  process.env.DATABASE_URL = 'postgresql://fake:fake@localhost/fake';
  app = require('../server');
});

afterEach(() => {
  mockQuery.mockReset();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');

function makeToken(role = 'tenant', id = 'user-001') {
  return jwt.sign({ id, role }, 'test_secret_itab', { expiresIn: '1h' });
}

/**
 * Auth mock helper.
 *
 * The server runs TWO DB queries before reaching any route handler on
 * authenticated mutating requests:
 *   1. Vetting middleware  → SELECT approval_status, role FROM users WHERE id=$1
 *   2. auth() middleware   → SELECT id, role, approval_status, permissions, ... FROM users WHERE id=$1
 *
 * We enqueue BOTH so mockQuery isn't consumed out of order.
 * GET requests skip the vetting middleware, so they only need one mock.
 */
function mockAuthUser(role = 'tenant', id = 'user-001', approvalStatus = 'approved', method = 'POST') {
  const userRow = {
    id,
    role,
    approval_status: approvalStatus,
    permissions: null,
    is_suspended: false,
    first_name: 'Test',
    last_name: 'User',
  };

  // Vetting middleware fires on non-GET requests that have a token
  if (method !== 'GET') {
    mockQuery.mockResolvedValueOnce({ rows: [{ approval_status: approvalStatus, role }] });
  }

  // auth() middleware
  mockQuery.mockResolvedValueOnce({ rows: [userRow] });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════
describe('Health', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. AIRTEL CALLBACK — core requirement
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/payments/airtel/callback', () => {
  test('marks payment completed on TS status', async () => {
    // UPDATE payments, UPDATE transactions, UPDATE inspections, INSERT audit_log
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const res = await request(app)
      .post('/api/payments/airtel/callback')
      .send({
        transaction: { id: 'AIR-123456', status_code: 'TS' },
        status: { code: 'TS', message: 'Transaction Successful' },
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.reference).toBe('AIR-123456');
    expect(res.body.processed).toBe(true);
  });

  test('marks payment failed on TF status', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const res = await request(app)
      .post('/api/payments/airtel/callback')
      .send({
        transaction: { id: 'AIR-FAIL-001', status_code: 'TF' },
        status: { code: 'TF', message: 'Transaction Failed' },
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.processed).toBe(true);
  });

  test('handles SUCCESS status code variant', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const res = await request(app)
      .post('/api/payments/airtel/callback')
      .send({ transaction: { id: 'AIR-789', status_code: 'SUCCESS' }, status: { code: 'SUCCESS' } });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  test('handles missing reference gracefully (no DB call)', async () => {
    const res = await request(app)
      .post('/api/payments/airtel/callback')
      .send({ transaction: {}, status: { code: 'TS' } });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  test('still returns 200 even when DB throws (Airtel must not retry)', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection lost'));

    const res = await request(app)
      .post('/api/payments/airtel/callback')
      .send({ transaction: { id: 'AIR-ERR-001' }, status: { code: 'TS' } });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ERROR');
    expect(res.body.processed).toBe(false);
  });

  test('accepts alternate payload shape (data.transaction)', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const res = await request(app)
      .post('/api/payments/airtel/callback')
      .send({ data: { transaction: { id: 'AIR-ALT-999' }, status: { code: 'TS' } } });

    expect(res.status).toBe(200);
    expect(res.body.reference).toBe('AIR-ALT-999');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. MTN CALLBACK
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/payments/mtn/callback', () => {
  test('marks payment completed on SUCCESSFUL status', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const res = await request(app)
      .post('/api/payments/mtn/callback')
      .send({
        externalId: 'MTN-111222',
        financialTransactionId: 'FINTX-001',
        status: 'SUCCESSFUL',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.reference).toBe('MTN-111222');
  });

  test('marks payment failed on FAILED status', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const res = await request(app)
      .post('/api/payments/mtn/callback')
      .send({ externalId: 'MTN-FAIL-001', status: 'FAILED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  test('returns 200 even on DB error', async () => {
    mockQuery.mockRejectedValue(new Error('timeout'));

    const res = await request(app)
      .post('/api/payments/mtn/callback')
      .send({ externalId: 'MTN-ERR-001', status: 'SUCCESSFUL' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ERROR');
  });

  test('handles empty body safely', async () => {
    const res = await request(app)
      .post('/api/payments/mtn/callback')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. AIRTEL INITIATE
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/payments/airtel/initiate', () => {
  test('returns a reference and pending status', async () => {
    // auth query + approval check
    mockAuthUser('tenant', 'user-001', 'approved', 'POST');
    // INSERT pending payment (non-fatal, optional)
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/payments/airtel/initiate')
      .set('Authorization', `Bearer ${makeToken('tenant')}`)
      .send({ phone: '0751234567', amount: 100000 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.reference).toMatch(/^AIR-/);
  });

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/payments/airtel/initiate')
      .send({ phone: '0751234567' });

    expect(res.status).toBe(401);
  });

  test('uses client-provided reference if given', async () => {
    mockAuthUser('tenant', 'user-001', 'approved', 'POST');
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/payments/airtel/initiate')
      .set('Authorization', `Bearer ${makeToken('tenant')}`)
      .send({ phone: '0751234567', amount: 50000, reference: 'MY-REF-001' });

    expect(res.status).toBe(200);
    expect(res.body.data.reference).toBe('MY-REF-001');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. MTN INITIATE
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/payments/mtn/initiate', () => {
  test('returns a reference and pending status', async () => {
    mockAuthUser('tenant', 'user-001', 'approved', 'POST');

    const res = await request(app)
      .post('/api/payments/mtn/initiate')
      .set('Authorization', `Bearer ${makeToken('tenant')}`)
      .send({ phone: '0771234567' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.reference).toMatch(/^MTN-/);
  });

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/payments/mtn/initiate')
      .send({ phone: '0771234567' });

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PAYMENT STATUS POLLING
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/payments/status/:ref', () => {
  test('returns completed when DB has completed payment', async () => {
    mockAuthUser('tenant', 'user-001', 'approved', 'GET');
    // payments table hit
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'completed' }] });

    const res = await request(app)
      .get('/api/payments/status/AIR-123456')
      .set('Authorization', `Bearer ${makeToken('tenant')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.reference).toBe('AIR-123456');
  });

  test('falls back to transactions table when payments has no row', async () => {
    mockAuthUser('tenant', 'user-001', 'approved', 'GET');
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no payments row
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'failed' }] }); // transactions row

    const res = await request(app)
      .get('/api/payments/status/MTN-999')
      .set('Authorization', `Bearer ${makeToken('tenant')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('failed');
  });

  test('returns pending when reference not found anywhere', async () => {
    mockAuthUser('tenant', 'user-001', 'approved', 'GET');
    mockQuery.mockResolvedValueOnce({ rows: [] }); // payments empty
    mockQuery.mockResolvedValueOnce({ rows: [] }); // transactions empty

    const res = await request(app)
      .get('/api/payments/status/UNKNOWN-REF')
      .set('Authorization', `Bearer ${makeToken('tenant')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. RENT PAYMENT (tenant pays rent)
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/payments/rent', () => {
  const tenantToken = makeToken('tenant', 'tenant-001');

  test('tenant can pay rent successfully', async () => {
    mockAuthUser('tenant', 'tenant-001', 'approved', 'POST');
    // SELECT tenant user
    mockQuery.mockResolvedValueOnce({ rows: [{ first_name: 'Grace', last_name: 'Apio' }] });
    // INSERT payment
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'pay-001', type: 'rent', amount: 800000, currency: 'UGX',
        status: 'completed', method: 'airtel_money', reference: 'AIR-RENT-001',
        property_id: 'prop-01', property_title: 'Kololo Apt', tenant_id: 'tenant-001',
        tenant_name: 'Grace Apio', landlord_id: 'landlord-001',
        inspection_credit_applied: 0, rent_period: '2024-07', is_partial: false,
        receipt_url: null, created_at: new Date().toISOString(), paid_at: new Date().toISOString(),
      }],
    });

    const res = await request(app)
      .post('/api/payments/rent')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        propertyId: 'prop-01', propertyTitle: 'Kololo Apt',
        amount: 800000, method: 'airtel_money',
        reference: 'AIR-RENT-001', rentPeriod: '2024-07',
        isPartial: false, landlordId: 'landlord-001',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.method).toBe('airtel_money');
    expect(res.body.data.amount).toBe(800000);
  });

  test('non-tenant cannot pay rent', async () => {
    mockAuthUser('landlord', 'landlord-001', 'approved', 'POST');

    const res = await request(app)
      .post('/api/payments/rent')
      .set('Authorization', `Bearer ${makeToken('landlord', 'landlord-001')}`)
      .send({ propertyId: 'prop-01', amount: 800000 });

    expect(res.status).toBe(403);
  });

  test('unauthenticated request is rejected', async () => {
    const res = await request(app).post('/api/payments/rent').send({ amount: 100 });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. INSPECTION FEE PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/inspections/:id/pay', () => {
  test('tenant can pay inspection fee', async () => {
    mockAuthUser('tenant', 'tenant-001', 'approved', 'POST');
    // UPDATE inspections
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'insp-001', property_id: 'prop-01', property_title: 'Kololo Apt',
        tenant_id: 'tenant-001', tenant_name: 'Grace Apio', manager_id: 'mgr-001',
        scheduled_date: '2024-07-10', scheduled_time: '10:00',
        status: 'pending', fee_amount: 100000, fee_paid: true,
        payment_method: 'airtel_money', payment_ref: 'AIR-INSP-001',
        credit_applied: false, no_show_count: 0, reschedule_count: 0,
        created_at: new Date().toISOString(),
      }],
    });
    // INSERT payments (non-fatal fire-and-forget)
    mockQuery.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/api/inspections/insp-001/pay')
      .set('Authorization', `Bearer ${makeToken('tenant', 'tenant-001')}`)
      .send({ method: 'airtel_money', reference: 'AIR-INSP-001', status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.data.feePaid).toBe(true);
    expect(res.body.data.paymentMethod).toBe('airtel_money');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. PAYMENT PREFERENCES (landlord, manager, vendor set receive method)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Payment Preferences', () => {
  test('landlord can save Airtel Money preferences', async () => {
    mockAuthUser('landlord', 'landlord-001', 'approved', 'POST');
    mockQuery.mockResolvedValueOnce({
      rows: [{
        user_id: 'landlord-001', preferred_method: 'airtel_money',
        airtel_phone: '0751234567', mtn_phone: null,
        bank_name: null, bank_account_number: null, bank_account_name: null,
      }],
    });

    const res = await request(app)
      .post('/api/payment-preferences')
      .set('Authorization', `Bearer ${makeToken('landlord', 'landlord-001')}`)
      .send({ preferredMethod: 'airtel_money', airtelPhone: '0751234567' });

    expect(res.status).toBe(200);
    expect(res.body.data.preferred_method).toBe('airtel_money');
    expect(res.body.data.airtel_phone).toBe('0751234567');
  });

  test('manager can save MTN MoMo preferences', async () => {
    mockAuthUser('property_manager', 'mgr-001', 'approved', 'POST');
    mockQuery.mockResolvedValueOnce({
      rows: [{
        user_id: 'mgr-001', preferred_method: 'mtn_momo',
        mtn_phone: '0771112233', airtel_phone: null,
      }],
    });

    const res = await request(app)
      .post('/api/payment-preferences')
      .set('Authorization', `Bearer ${makeToken('property_manager', 'mgr-001')}`)
      .send({ preferredMethod: 'mtn_momo', mtnPhone: '0771112233' });

    expect(res.status).toBe(200);
    expect(res.body.data.preferred_method).toBe('mtn_momo');
  });

  test('can retrieve saved preferences', async () => {
    mockAuthUser('landlord', 'landlord-001', 'approved', 'GET');
    mockQuery.mockResolvedValueOnce({
      rows: [{ user_id: 'landlord-001', preferred_method: 'airtel_money', airtel_phone: '0751234567' }],
    });

    const res = await request(app)
      .get('/api/payment-preferences/landlord-001')
      .set('Authorization', `Bearer ${makeToken('landlord', 'landlord-001')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.preferred_method).toBe('airtel_money');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. TRANSACTIONS (audit trail)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Transactions', () => {
  test('tenant can view own transactions', async () => {
    mockAuthUser('tenant', 'tenant-001', 'approved', 'GET');
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'tx-001', type: 'rent_payment', sender_id: 'tenant-001',
          sender_name: 'Grace Apio', sender_role: 'tenant',
          sender_method: 'airtel_money', sender_phone: '0751234567',
          receiver_id: 'escrow', receiver_name: 'ITAB Escrow', receiver_role: 'platform',
          receiver_method: 'escrow', receiver_phone: null, receiver_bank_details: null,
          amount: 800000, currency: 'UGX', reference: 'AIR-RENT-001',
          status: 'completed', property_id: 'prop-01', property_title: 'Kololo Apt',
          description: 'Rent payment', inspection_credit_applied: 0,
          rent_period: '2024-07', is_partial: false, receipt_url: null,
          created_at: new Date().toISOString(), processed_at: new Date().toISOString(),
          failure_reason: null,
        },
      ],
    });

    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${makeToken('tenant', 'tenant-001')}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].type).toBe('rent_payment');
    expect(res.body.data[0].senderMethod).toBe('airtel_money');
  });

  test('admin can retry a failed transaction', async () => {
    mockAuthUser('admin', 'admin-001', 'approved', 'PATCH');
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'tx-fail-001', type: 'landlord_payout', status: 'completed',
        sender_id: 'escrow', sender_name: 'ITAB Escrow', sender_role: 'platform',
        sender_method: 'escrow', receiver_id: 'landlord-001',
        receiver_name: 'John Ssemakula', receiver_role: 'landlord',
        receiver_method: 'mtn_momo', amount: 692000, currency: 'UGX',
        reference: 'TX-RETRY-001', description: 'retry test',
        inspection_credit_applied: 0, is_partial: false,
        created_at: new Date().toISOString(), processed_at: new Date().toISOString(),
      }],
    });

    const res = await request(app)
      .patch('/api/transactions/tx-fail-001/retry')
      .set('Authorization', `Bearer ${makeToken('admin', 'admin-001')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. PAYOUTS (landlord receives net rent)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Payouts', () => {
  test('landlord can list own payouts', async () => {
    mockAuthUser('landlord', 'landlord-001', 'approved', 'GET');
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'po-001', landlord_id: 'landlord-001', landlord_name: 'John Ssemakula',
        property_id: 'prop-01', property_title: 'Kololo Apt',
        gross_rent: 900000, management_fee: 90000, itab_fee: 18000,
        net_amount: 792000, status: 'completed', method: 'airtel_money',
        reference: 'PAYOUT-001', scheduled_date: '2024-07-05',
        processed_at: new Date().toISOString(), retry_count: 0,
      }],
    });

    const res = await request(app)
      .get('/api/payouts')
      .set('Authorization', `Bearer ${makeToken('landlord', 'landlord-001')}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].netAmount).toBe(792000);
    expect(res.body.data[0].method).toBe('airtel_money');
  });

  test('admin can process a payout', async () => {
    mockAuthUser('admin', 'admin-001', 'approved', 'POST');
    // UPDATE payouts
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'po-002', landlord_id: 'landlord-001', landlord_name: 'John',
        property_id: 'prop-01', property_title: 'Kololo', gross_rent: 500000,
        management_fee: 50000, itab_fee: 10000, net_amount: 440000,
        status: 'completed', method: 'mtn_momo', reference: 'PAYOUT-002',
        scheduled_date: '2024-07-10', processed_at: new Date().toISOString(), retry_count: 0,
      }],
    });
    // audit_log insert (fire and forget — mock silently)
    mockQuery.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/api/payouts/po-002/process')
      .set('Authorization', `Bearer ${makeToken('admin', 'admin-001')}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. FULL PAYMENT FLOW — end-to-end simulation
//     Tenant pays Airtel → callback fires → status shows completed
// ═══════════════════════════════════════════════════════════════════════════════
describe('End-to-end: Airtel payment flow', () => {
  test('initiate → callback → status = completed', async () => {
    const ref = `AIR-E2E-${Date.now()}`;

    // Step 1: Tenant initiates payment
    mockAuthUser('tenant', 'tenant-001', 'approved', 'POST');
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT pending payment

    const initRes = await request(app)
      .post('/api/payments/airtel/initiate')
      .set('Authorization', `Bearer ${makeToken('tenant', 'tenant-001')}`)
      .send({ phone: '0751234567', amount: 100000, reference: ref });

    expect(initRes.status).toBe(200);
    expect(initRes.body.data.reference).toBe(ref);
    expect(initRes.body.data.status).toBe('pending');

    // Step 2: Airtel fires callback (no auth)
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

    const cbRes = await request(app)
      .post('/api/payments/airtel/callback')
      .send({ transaction: { id: ref, status_code: 'TS' }, status: { code: 'TS' } });

    expect(cbRes.status).toBe(200);
    expect(cbRes.body.processed).toBe(true);

    // Step 3: App polls status → sees completed
    mockAuthUser('tenant', 'tenant-001', 'approved', 'GET');
    mockQuery.mockResolvedValueOnce({ rows: [{ status: 'completed' }] });

    const statusRes = await request(app)
      .get(`/api/payments/status/${ref}`)
      .set('Authorization', `Bearer ${makeToken('tenant', 'tenant-001')}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('completed');
    expect(statusRes.body.data.reference).toBe(ref);
  });
});
