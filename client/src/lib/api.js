// Unified data access layer.
// In DEMO_MODE returns static data instantly (no network). Otherwise calls the backend.
import { DEMO_MODE } from './config';
import {
  DEMO_RECS, DEMO_HOLDINGS, DEMO_LISTINGS,
  DEMO_AUDIT_SUMMARY, DEMO_AUDIT_DETAIL,
} from './demo';

const BASE = import.meta.env.VITE_API_URL || '';

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  const d = await r.json();
  if (d && d.error) throw new Error(d.error);
  return d;
}

export async function fetchListings() {
  if (DEMO_MODE) return DEMO_LISTINGS;
  return get('/api/listings');
}

export async function fetchRec(tokenId) {
  if (DEMO_MODE) {
    const rec = DEMO_RECS[String(tokenId)];
    if (!rec) throw new Error(`Token #${tokenId} not found`);
    return rec;
  }
  return get(`/api/recs/${tokenId}`);
}

export async function fetchPortfolio(address) {
  if (DEMO_MODE) return DEMO_HOLDINGS;
  return get(`/api/listings/portfolio/${address}`);
}

export async function fetchAuditSummary() {
  if (DEMO_MODE) return DEMO_AUDIT_SUMMARY;
  return get('/api/audit/summary');
}

export async function fetchAuditDetail(meterId) {
  if (DEMO_MODE) {
    const d = DEMO_AUDIT_DETAIL[meterId];
    if (!d) throw new Error(`Meter ${meterId} not found`);
    return d;
  }
  return get(`/api/audit/meter/${meterId}`);
}
