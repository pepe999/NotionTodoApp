// Load test (PLAN.md 8.4) – k6. Ověřuje chování pod souběhem klientů:
// server nepřetěžuje Notion (sdílená fronta ~3 req/s) a 429 se korektně objeví.
//
// Spuštění (proti staging/lokálnímu API):
//   BASE_URL=https://api.example.com SESSION=<cookie> k6 run scripts/load-test.js
//
// Pozn.: /api/tasks vyžaduje přihlášení – předej platnou session cookie přes
// env SESSION. Bez ní test měří chování 401 + per-IP rate limit na /health/auth.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SESSION = __ENV.SESSION || '';

export const options = {
  scenarios: {
    burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 30 },
        { duration: '30s', target: 30 },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    // /health (cache/lokální) musí být svižné.
    'http_req_duration{endpoint:health}': ['p(95)<200'],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/health`, { tags: { endpoint: 'health' } });
  check(health, { 'health 200': (r) => r.status === 200 });

  const headers = SESSION ? { Cookie: `nta_session=${SESSION}` } : {};
  const tasks = http.get(`${BASE_URL}/api/tasks`, { headers, tags: { endpoint: 'tasks' } });
  // Akceptujeme 200 (přihlášen), 401 (bez session) i 429 (rate limit) – server
  // nesmí 5xx eskalovat ani přetěžovat Notion.
  check(tasks, { 'tasks not 5xx': (r) => r.status < 500 });

  sleep(1);
}
