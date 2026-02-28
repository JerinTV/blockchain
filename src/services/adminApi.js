const API_BASE = "https://blockchain-li7r.onrender.com";

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

async function parseOrThrow(res, fallbackMsg) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || fallbackMsg);
  }
  return data;
}

export async function fetchAdminOverview() {
  const res = await fetch(`${API_BASE}/admin/overview`, { headers: authHeaders() });
  return parseOrThrow(res, "Failed to load admin overview");
}

export async function fetchAdminUsers() {
  const res = await fetch(`${API_BASE}/admin/users`, { headers: authHeaders() });
  return parseOrThrow(res, "Failed to load users");
}

export async function updateAdminUser(id, payload) {
  const res = await fetch(`${API_BASE}/admin/users/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return parseOrThrow(res, "Failed to update user");
}

export async function deleteAdminUser(id) {
  const res = await fetch(`${API_BASE}/admin/users/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  return parseOrThrow(res, "Failed to delete user");
}

export async function fetchAdminProducts(limit = 200) {
  const res = await fetch(`${API_BASE}/admin/products?limit=${limit}`, { headers: authHeaders() });
  return parseOrThrow(res, "Failed to load products");
}

export async function updateAdminProduct(productId, payload) {
  const res = await fetch(`${API_BASE}/admin/products/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  return parseOrThrow(res, "Failed to update product");
}

export async function fetchSalesAnalytics(range = "week") {
  const res = await fetch(`${API_BASE}/admin/sales-analytics?range=${range}`, { headers: authHeaders() });
  return parseOrThrow(res, "Failed to load analytics");
}

export async function fetchAdminBlockchainBlocks(limit = 12) {
  const res = await fetch(`${API_BASE}/admin/blockchain-blocks?limit=${limit}`, {
    headers: authHeaders()
  });
  return parseOrThrow(res, "Failed to load blockchain blocks");
}
