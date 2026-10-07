// End-to-end: real conductor login → real GPS POST → real backend → real socket → passenger tracking.
import { io } from "socket.io-client";

const API = "http://127.0.0.1:5000/api/v1";
const fails = [];
const ok = (name) => console.log(`  PASS ${name}`);
const bad = (name, e) => { console.log(`  FAIL ${name}: ${e}`); fails.push(name); };

const step = async (name, fn) => { try { await fn(); ok(name); } catch (e) { bad(name, e.message ?? e); } };
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

let conductorToken, tripId, trackingToken, pnr;

await step("conductor login (real /auth/login)", async () => {
  const res = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "9876500001", password: "Conductor@123" }) });
  const json = await res.json();
  expect(res.ok, `status ${res.status}: ${JSON.stringify(json)}`);
  conductorToken = json.accessToken;
  // GET trips to discover our live trip
  const t = await fetch(`${API}/conductor/trips`, { headers: { Authorization: `Bearer ${conductorToken}` } });
  const tj = await t.json();
  expect(t.ok, `trips ${t.status}`);
  const live = tj.items.find((x) => x.status === "IN_PROGRESS");
  expect(live, "no IN_PROGRESS trip");
  tripId = live.id;
});

await step("conductor posts real GPS fix", async () => {
  const res = await fetch(`${API}/conductor/trips/${tripId}/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${conductorToken}` },
    body: JSON.stringify({ latitude: 17.385, longitude: 78.4867, accuracy: 12, speed: 8.3, heading: 90, at: new Date().toISOString() }),
  });
  expect(res.ok, `status ${res.status}: ${await res.text()}`);
});

await step("passenger PNR lookup", async () => {
  const res = await fetch(`${API}/tracking/lookup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pnr: "KRTRK123" }) });
  const json = await res.json();
  expect(res.ok, `status ${res.status}: ${JSON.stringify(json)}`);
  expect(json.trip.bus.registrationNo, "missing bus");
  expect(json.token, "missing token");
  trackingToken = json.token; pnr = "KRTRK123";
  console.log(`    trip: ${json.trip.origin} → ${json.trip.destination}, bus ${json.trip.bus.registrationNo}, status ${json.trip.status}`);
});

await step("passenger mobile lookup", async () => {
  const res = await fetch(`${API}/tracking/lookup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile: "+919876501234" }) });
  const json = await res.json();
  expect(res.ok, `status ${res.status}: ${JSON.stringify(json)}`);
  console.log(`    trip status ${json.trip.status}`);
});

await step("invalid PNR rejected", async () => {
  const res = await fetch(`${API}/tracking/lookup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pnr: "KRXXXX99" }) });
  expect(res.status === 404 || res.status === 400, `got ${res.status}`);
});

await step("unauthorized location without token", async () => {
  const res = await fetch(`${API}/tracking/location`);
  expect(res.status === 401, `got ${res.status}`);
});

await step("socket connects with tracking token and receives live fix", async () => {
  const socket = io("http://127.0.0.1:5000", { auth: { token: trackingToken }, transports: ["websocket", "polling"] });
  await new Promise((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
    setTimeout(() => reject(new Error("connect timeout")), 8000);
  });
  const got = new Promise((resolve, reject) => {
    socket.on("location", resolve);
    setTimeout(() => reject(new Error("no location event in 10s")), 10000);
  });
  // conductor posts a new fix → should stream to our socket
  await fetch(`${API}/conductor/trips/${tripId}/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${conductorToken}` },
    body: JSON.stringify({ latitude: 17.39, longitude: 78.49, accuracy: 10, speed: 12.5, heading: 45, at: new Date().toISOString() }),
  });
  const fix = await got;
  expect(Math.abs(fix.latitude - 17.39) < 0.001, `lat ${fix.latitude}`);
  console.log(`    live fix via socket: ${fix.latitude},${fix.longitude} ${Math.round(fix.speed * 3.6)}km/h`);
  socket.disconnect();
});

await step("polling GET /tracking/location returns latest fix", async () => {
  const res = await fetch(`${API}/tracking/location`, { headers: { Authorization: `Bearer ${trackingToken}` } });
  const json = await res.json();
  expect(res.ok && Math.abs(json.location.latitude - 17.39) < 0.001, JSON.stringify(json).slice(0, 120));
});

console.log(fails.length === 0 ? "\nALL E2E CHECKS PASSED" : `\n${fails.length} FAILURES`);
process.exit(fails.length === 0 ? 0 : 1);
