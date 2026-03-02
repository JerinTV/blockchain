// frontend/src/nfc/nfcScanner.js

/*
  FIX B:
  Frontend calls backend NFC emulator
*/

export async function scanNfcTag(productId, challenge) {
  console.warn("NFC emulation via backend");
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

  const res = await fetch(`${API_BASE}/nfc/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      productId,
      challenge
    })
  });

  if (!res.ok) {
    throw new Error("Backend NFC signing failed");
  }

  const data = await res.json();

  return data.response;
}