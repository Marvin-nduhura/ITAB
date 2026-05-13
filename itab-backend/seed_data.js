/**
 * Seed data with proper UUIDs for the Render PostgreSQL database.
 * Users use UUID primary keys (matching the existing schema).
 * All other entities use TEXT ids.
 */

// Fixed UUIDs for the 6 mock users — consistent across re-runs
const USER_IDS = {
  admin:   '00000000-0000-0000-0000-000000000001',
  manager: '00000000-0000-0000-0000-000000000002',
  landlord:'00000000-0000-0000-0000-000000000003',
  tenant:  '00000000-0000-0000-0000-000000000004',
  agent:   '00000000-0000-0000-0000-000000000005',
  vendor:  '00000000-0000-0000-0000-000000000006',
};

module.exports = { USER_IDS };
