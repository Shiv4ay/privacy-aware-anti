// frontend/src/devAutoLogin.js
// Automatically fetches a dev JWT in development mode.
// Compatible with your backend index.js, devAuth.js, and .env values.

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const DEV_AUTH_KEY = import.meta.env.VITE_DEV_AUTH_KEY || "super-secret-dev-key"; 
// (If you want, you can add VITE_DEV_AUTH_KEY in your frontend .env)

async function getDevToken() {
  try {
    const res = await fetch(`${API_URL}/api/dev/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: DEV_AUTH_KEY,
        user: { id: 1, username: "siba", roles: ["admin"] }
      })
    });

    if (!res.ok) throw new Error(`dev token request failed ${res.status}`);

    const data = await res.json();
    if (!data.token) throw new Error("No token returned");

    localStorage.setItem("dev_jwt", data.token);
    console.log("✔ Dev JWT stored in localStorage");

    return data.token;
  } catch (err) {
    console.error("❌ getDevToken error:", err);
    return null;
  }
}

// Wrapper fetch that auto-attaches JWT
async function devFetch(url, opts = {}) {
  const token = localStorage.getItem("dev_jwt");
  const headers = new Headers(opts.headers || {});

  if (token) headers.set("Authorization", `Bearer ${token}`);

  if (!headers.has("Content-Type") && opts.body && typeof opts.body === "object") {
    headers.set("Content-Type", "application/json");
    opts.body = JSON.stringify(opts.body);
  }

  const final = { ...opts, headers };
  const res = await fetch(`${API_URL}${url}`, final);

  // Token expired → refresh once
  if (res.status === 401) {
    console.warn("⚠ Token expired → refreshing dev token...");
    await getDevToken();
    const t2 = localStorage.getItem("dev_jwt");
    headers.set("Authorization", `Bearer ${t2}`);
    return fetch(`${API_URL}${url}`, { ...opts, headers });
  }

  return res;
}

// Auto-run only in dev
if (import.meta.env.MODE === "development") {
  console.log("🔧 Development mode → fetching dev token...");
  getDevToken();
}

export { getDevToken, devFetch };
