// frontend/src/services/api.js

// frontend/src/services/api.js

const BASE_URL = "https://blockchain-li7r.onrender.com";

export async function requestChallenge(productId) {
  const res = await fetch(`${BASE_URL}/challenge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ productId })
  });

  if (!res.ok) {
    throw new Error("Failed to get challenge");
  }

  const data = await res.json();

  console.log("API DEBUG /challenge response:", data);

  return data; // MUST be { challenge: "..." }
}


export async function verifyResponse(productId, response) {
  const res = await fetch(`${BASE_URL}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ productId, response })
  });

  if (!res.ok) {
    throw new Error("Verification request failed");
  }

  return res.json();
}
