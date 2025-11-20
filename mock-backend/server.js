// mock-backend/server.js
// Simple mock API for Privacy-RAG frontend testing
// - CORS configured to return the request origin when allowed
// - Endpoints: /api/auth/register, /send-otp, /verify-otp, /login, /forgot, /reset
// - Protected /api/upload (requires Bearer token) and public /api/upload-public
// - Dashboard + search endpoints (protected)
// NOTE: In-memory stores only — not for production

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");

const upload = multer();
const app = express();

// Load port from env or default
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key";

// Allowed origins for CORS - add your dev origin(s) and production domain(s) here
const allowedOrigins = [
  "http://localhost:5173", // Vite dev server
  "http://127.0.0.1:5173",
  "http://localhost:3000", // optional if you serve frontend differently
];

// CORS middleware: allow credentials and echo origin when it's allowed
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) {
    // allow non-browser requests (curl, postman)
    res.header("Access-Control-Allow-Origin", "*");
  } else if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
  } else {
    // Not allowed origin: still set something simple for non-browser clients — but browser will block
    res.header("Access-Control-Allow-Origin", "null");
  }

  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With,Accept");
  // If it's preflight, short-circuit
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Also use express.json / body-parser
app.use(bodyParser.json());

// In-memory stores (mock/demo)
let users = {};      // userId -> { id, name, email, phone, passwordHash, verified, role }
let otps = {};       // userId -> { code, expiresAt }
let nextId = 1;

// Helpers
function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

// Logging helper
function log(...args) {
  console.log(new Date().toISOString(), "|", ...args);
}

// --- Routes ---

// Health
app.get("/api/health", (req, res) => res.json({ ok: true, now: new Date().toISOString() }));

// Register: create user (unverified)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "email & password required" });
    const existing = Object.values(users).find(u => u.email === email);
    if (existing) return res.status(400).json({ message: "email already registered" });

    const id = String(nextId++);
    const passwordHash = await bcrypt.hash(password, 10);
    users[id] = { id, name: name || "", email, phone: phone || "", passwordHash, verified: false, role: "user" };
    log("REGISTER user:", id, users[id].email);
    return res.json({ userId: id });
  } catch (err) {
    log("REGISTER err:", err.message);
    return res.status(500).json({ message: "internal error" });
  }
});

// Send OTP for verification / password flows
app.post("/api/auth/send-otp", (req, res) => {
  try {
    const { userId, via = "email" } = req.body || {};
    if (!userId || !users[userId]) return res.status(400).json({ message: "invalid userId" });

    const code = genOtp();
    otps[userId] = { code, expiresAt: Date.now() + 1000 * 60 * 10 }; // 10 minutes
    // In a real app you'd send code via email/SMS. Here we log it so developer can read.
    log(`OTP for user ${userId} (${via}): ${code}`);
    return res.json({ ok: true });
  } catch (err) {
    log("SEND-OTP err:", err.message);
    return res.status(500).json({ message: "internal error" });
  }
});

// Verify OTP -> mark user verified and return token + user
app.post("/api/auth/verify-otp", (req, res) => {
  try {
    const { userId, code } = req.body || {};
    if (!userId || !users[userId]) return res.status(400).json({ message: "invalid userId" });

    const entry = otps[userId];
    if (!entry || entry.code !== String(code) || Date.now() > entry.expiresAt) {
      return res.status(400).json({ message: "invalid or expired OTP" });
    }
    users[userId].verified = true;
    const token = signToken(users[userId]);
    delete otps[userId];
    log("VERIFY-OTP user:", userId, "-> verified");
    return res.json({
      token,
      user: { id: users[userId].id, name: users[userId].name, email: users[userId].email, phone: users[userId].phone, role: users[userId].role }
    });
  } catch (err) {
    log("VERIFY-OTP err:", err.message);
    return res.status(500).json({ message: "internal error" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "email & password required" });
    const user = Object.values(users).find(u => u.email === email);
    if (!user) return res.status(400).json({ message: "invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ message: "invalid credentials" });
    if (!user.verified) return res.status(403).json({ message: "account not verified" });
    const token = signToken(user);
    log("LOGIN user:", user.id, user.email);
    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
  } catch (err) {
    log("LOGIN err:", err.message);
    return res.status(500).json({ message: "internal error" });
  }
});

// Forgot: issue OTP for password reset (logs code)
app.post("/api/auth/forgot", (req, res) => {
  try {
    const { email } = req.body || {};
    const user = Object.values(users).find(u => u.email === email);
    if (!user) return res.json({ ok: true }); // don't reveal existence
    const code = genOtp();
    otps[user.id] = { code, expiresAt: Date.now() + 1000 * 60 * 10 };
    log(`Password reset OTP for ${email}: ${code}`);
    return res.json({ ok: true });
  } catch (err) {
    log("FORGOT err:", err.message);
    return res.status(500).json({ message: "internal error" });
  }
});

// Reset password using code
app.post("/api/auth/reset", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    const user = Object.values(users).find(u => u.email === email);
    if (!user) return res.status(400).json({ message: "invalid" });
    const e = otps[user.id];
    if (!e || e.code !== String(code) || Date.now() > e.expiresAt) return res.status(400).json({ message: "invalid or expired code" });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    delete otps[user.id];
    log("RESET password for:", user.id);
    return res.json({ ok: true });
  } catch (err) {
    log("RESET err:", err.message);
    return res.status(500).json({ message: "internal error" });
  }
});

// Optional logout endpoint (front can call but server stateless here)
app.post("/api/auth/logout", (req, res) => {
  return res.json({ ok: true });
});

// Auth middleware for protected endpoints
function authMiddleware(req, res, next) {
  try {
    const auth = (req.headers.authorization || "").replace("Bearer ", "");
    if (!auth) return res.status(401).json({ message: "unauthenticated" });
    const payload = jwt.verify(auth, JWT_SECRET);
    const user = users[payload.id];
    if (!user) return res.status(401).json({ message: "invalid token" });
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "invalid token" });
  }
}

// Protected upload: requires Authorization Bearer token
app.post("/api/upload", authMiddleware, upload.single("file"), (req, res) => {
  log("Protected upload:", req.user?.id, req.file?.originalname);
  // Here you'd push file to processing queue / storage - we just return success
  return res.json({ message: "queued (protected)" });
});

// Public upload (no auth) - useful for UI testing
app.post("/api/upload-public", upload.single("file"), (req, res) => {
  log("Public upload received. file:", req.file?.originalname || "(no file)");
  return res.json({ message: "queued (public)" });
});

// Protected dashboard overview
app.get("/api/dashboard/overview", authMiddleware, (req, res) => {
  return res.json({
    documents: 12,
    recent_searches: 8,
    status: "ok",
    activity: [{ msg: "Uploaded file A", ts: new Date().toISOString() }]
  });
});

// Protected search endpoint (mock)
app.post("/api/search", authMiddleware, (req, res) => {
  const { query } = req.body || {};
  return res.json({
    answer: { text: `Mock answer for "${query}"` },
    sources: [{ text: "Mock source content", score: 0.9, metadata: { source: "mock.pdf" } }]
  });
});

// Mock documents list
app.get("/api/documents", authMiddleware, (req, res) => {
  return res.json([
    { id: "d1", title: "Employee Handbook", source: "handbook.pdf" },
    { id: "d2", title: "Contract", source: "contract.docx" }
  ]);
});

// Default 404 for unknown API routes
app.use("/api", (req, res) => res.status(404).json({ message: "not found" }));

// Basic root
app.get("/", (req, res) => res.send(`Mock backend running. Try GET /api/health`));

// Start server
app.listen(PORT, () => {
  log(`Mock backend listening on http://localhost:${PORT}`);
});

// Graceful error logging
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err && err.stack ? err.stack : err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
