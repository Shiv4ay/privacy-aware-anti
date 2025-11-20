/**
 * minio-init.js
 * Robust MinIO client creation for Docker / host envs.
 */
const url = require("url");
const Minio = require("minio");

function parseMinioEndpoint(raw) {
  if (!raw) return null;
  raw = String(raw).trim();

  // If it has scheme, parse and extract hostname and port
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    const p = url.parse(raw);
    const hostname = p.hostname;
    const port = p.port || (p.protocol === "https:" ? 443 : 80);
    const useSSL = p.protocol === "https:";
    return { host: hostname, port: parseInt(port,10), useSSL };
  }

  // If has path components, drop them (keep host:port)
  if (raw.includes("/")) {
    raw = raw.split("/")[0];
  }

  // host:port
  if (raw.includes(":")) {
    const [host, port] = raw.split(":");
    return { host, port: parseInt(port,10), useSSL: false };
  }

  // host only
  return { host: raw, port: 9000, useSSL: false };
}

const raw = process.env.MINIO_ENDPOINT || process.env.MINIO_HOST || process.env.MINIO_HOST_URL || "minio:9000";
const parsed = parseMinioEndpoint(raw);

// fallback to individual env vars if present
const host = parsed?.host || (process.env.MINIO_HOST || "minio");
const port = parsed?.port || (process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT,10) : 9000);
const useSSL = typeof parsed?.useSSL === "boolean" ? parsed.useSSL : false;

// Credentials: prefer MINIO_ACCESS_KEY / MINIO_SECRET_KEY else root vars
const accessKey = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || process.env.MINIO_ROOT_USERNAME;
const secretKey = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_ROOT_PASSWORD;

if (!accessKey || !secretKey) {
  console.warn("MinIO credentials missing - MINIO_ACCESS_KEY or MINIO_SECRET_KEY not set.");
}

const minioClient = new Minio.Client({
  endPoint: host,
  port: Number(port || 9000),
  useSSL: !!useSSL,
  accessKey: accessKey,
  secretKey: secretKey
});

module.exports = { minioClient };
