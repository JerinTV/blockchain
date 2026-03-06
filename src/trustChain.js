import { ethers } from "ethers";
import TrustChainAbi from "./TrustChainAbi.json";

/* ================= CONFIG ================= */

// Replace the below with your contract address, or use import.meta.env for Vite, or process.env for CRA at build time
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

/* ================= PROVIDER ================= */

const getProvider = () => {
  if (!window.ethereum) throw new Error("MetaMask not found");
  return new ethers.BrowserProvider(window.ethereum);
};

const buildManufacturerQuery = (manufacturerId) => {
  if (!manufacturerId) return "";
  return `?manufacturerId=${encodeURIComponent(manufacturerId)}`;
};

const resolveManufacturerIdByBox = async (boxId, token) => {
  const res = await fetch(`${API_BASE}/api/db/resolve/box/${encodeURIComponent(boxId)}`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Unable to resolve manufacturer from boxId");
  }

  const data = await res.json();
  return data.manufacturerId;
};

const resolveManufacturerIdByProduct = async (productId, token) => {
  const res = await fetch(`${API_BASE}/api/db/resolve/product/${encodeURIComponent(productId)}`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Unable to resolve manufacturer from productId");
  }

  const data = await res.json();
  return data.manufacturerId;
};

/* ================= CONTRACT ================= */

const getContract = async () => {
  if (!window.ethereum) throw new Error("MetaMask not found");
  await window.ethereum.request({ method: "eth_requestAccounts" });

  const provider = getProvider();
  const signer = await provider.getSigner();

  return new ethers.Contract(CONTRACT_ADDRESS, TrustChainAbi, signer);
};

/* ================= WALLET ================= */

export const connectBlockchain = async () => {
  if (!window.ethereum) throw new Error("MetaMask not found");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  const address = accounts?.[0] || "";
  console.log("✅ Wallet connected");
  return address;
};

/* ================= BACKEND SECRET STORAGE ================= */



/* ================= SECRET HELPERS ================= */



/* ================= ⭐ BATCH REGISTER (PRODUCTION) ================= */

export const registerBatch = async (batch) => {
  try {
    const contract = await getContract();
    const token = localStorage.getItem("token");

    const prepareRes = await fetch(`${API_BASE}/prepare-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(batch)
    });

    if (!prepareRes.ok) {
      const err = await prepareRes.json();
      return { success: false, message: err.error };
    }

    const { items, draftToken, batchId, boxId } = await prepareRes.json();

    const tx = await contract.registerBatchProducts(
      batchId,
      boxId,
      items
    );

    await tx.wait();

    const finalizeRes = await fetch(`${API_BASE}/finalize-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        draftToken,
        txHash: tx.hash
      })
    });

    if (!finalizeRes.ok) {
      const err = await finalizeRes.json().catch(() => ({}));
      return {
        success: false,
        message: `${err.error || "DB finalization failed"} (tx: ${tx.hash})`
      };
    }

    return { success: true };

  } catch (err) {

    let message = "Batch registration failed";

    if (err.reason) message = err.reason;
    else if (err.shortMessage) message = err.shortMessage;
    else if (err.message) message = err.message;

    return { success: false, message };
  }
};


/* ================= SHIP ================= */

export const shipBox = async (boxId, manufacturerId = null, shippingAddress = "", retailerEmail = "") => {
  const contract = await getContract();
  const tx = await contract.shipBox(boxId);
  await tx.wait();

  const token = localStorage.getItem("token");
  const resolvedManufacturerId = manufacturerId ?? await resolveManufacturerIdByBox(boxId, token);
  const normalizedShippingAddress = String(shippingAddress || "").trim();
  const normalizedRetailerEmail = String(retailerEmail || "").trim();
  const query = buildManufacturerQuery(resolvedManufacturerId);
  const syncRes = await fetch(`${API_BASE}/api/db/box/${encodeURIComponent(boxId)}/ship${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      manufacturerId: resolvedManufacturerId,
      shippingAddress: normalizedShippingAddress || undefined,
      retailerEmail: normalizedRetailerEmail || undefined
    })
  });

  if (!syncRes.ok) {
    const err = await syncRes.json().catch(() => ({}));
    throw new Error(err.error || "DB ship sync failed");
  }

  console.log("📦 Box shipped:", boxId);
};


/* ================= BOX QUERY ================= */

export const getProductIdsByBox = async (boxId) => {
  const contract = await getContract();
  const ids = await contract.getProductsByBox(boxId);
  return ids.map(id => id.toString());
};

/* ================= RETAILER VERIFY ================= */

export const verifyBox = async (boxId, manufacturerId = null) => {
  const contract = await getContract();
  const tx = await contract.verifyBox(boxId);
  await tx.wait();

  const token = localStorage.getItem("token");
  const resolvedManufacturerId = manufacturerId ?? await resolveManufacturerIdByBox(boxId, token);
  const query = buildManufacturerQuery(resolvedManufacturerId);
  const syncRes = await fetch(`${API_BASE}/api/db/box/${encodeURIComponent(boxId)}/verify${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ manufacturerId: resolvedManufacturerId })
  });

  if (!syncRes.ok) {
    const err = await syncRes.json().catch(() => ({}));
    throw new Error(err.error || "DB verify sync failed");
  }

  console.log("✅ Box verified by Retailer:", boxId);
};

export const saleCompleteBox = async (boxId, manufacturerId = null, buyerEmail = "") => {
  const contract = await getContract();
  try {
    const tx = await contract.saleBox(boxId);
    await tx.wait();
  } catch (err) {
    const isMissingMethod =
      String(err?.message || "").toLowerCase().includes("is not a function") ||
      String(err?.shortMessage || "").toLowerCase().includes("could not decode result data");

    if (!isMissingMethod) throw err;

    const ids = await contract.getProductsByBox(boxId);
    if (!ids || ids.length === 0) {
      throw new Error("Box not found on-chain");
    }

    for (const productId of ids) {
      const tx = await contract.saleComplete(String(productId));
      await tx.wait();
    }
  }

  const token = localStorage.getItem("token");
  const resolvedManufacturerId = manufacturerId ?? await resolveManufacturerIdByBox(boxId, token);
   const normalizedBuyerEmail = String(buyerEmail || "").trim();
   const query = buildManufacturerQuery(resolvedManufacturerId);
   const syncRes = await fetch(`${API_BASE}/api/db/box/${encodeURIComponent(boxId)}/sold${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      manufacturerId: resolvedManufacturerId,
      buyerEmail: normalizedBuyerEmail || undefined
    })
  });

  if (!syncRes.ok) {
    const err = await syncRes.json().catch(() => ({}));
    throw new Error(err.error || "DB box sold sync failed");
  }
};

export const verifyProduct = async (productId, manufacturerId = null) => {
  const contract = await getContract();
  const tx = await contract.verifyProduct(productId);
  await tx.wait();

  const token = localStorage.getItem("token");
  const resolvedManufacturerId = manufacturerId ?? await resolveManufacturerIdByProduct(productId, token);
  const query = buildManufacturerQuery(resolvedManufacturerId);
  const syncRes = await fetch(`${API_BASE}/api/db/product/${encodeURIComponent(productId)}/verify${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ manufacturerId: resolvedManufacturerId })
  });

  if (!syncRes.ok) {
    const err = await syncRes.json().catch(() => ({}));
    throw new Error(err.error || "DB verify sync failed");
  }

  console.log("✅ Product verified:", productId);
};

/* ================= SALE ================= */

export const saleComplete = async (productId, manufacturerId = null, buyerEmail = "") => {
  const contract = await getContract();
  const tx = await contract.saleComplete(productId);
  await tx.wait();

  const token = localStorage.getItem("token");
  const resolvedManufacturerId = manufacturerId ?? await resolveManufacturerIdByProduct(productId, token);
  const query = buildManufacturerQuery(resolvedManufacturerId);
  const normalizedBuyerEmail = String(buyerEmail || "").trim();
  const syncRes = await fetch(`${API_BASE}/api/db/product/${encodeURIComponent(productId)}/sold${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      manufacturerId: resolvedManufacturerId,
      buyerEmail: normalizedBuyerEmail || undefined
    })
  });

  if (!syncRes.ok) {
    const err = await syncRes.json().catch(() => ({}));
    throw new Error(err.error || "DB sold sync failed");
  }

  console.log("💰 Sold:", productId);
};

/* ================= FETCH PRODUCT ================= */

export const getProduct = async (productId) => {
  const contract = await getContract();
  const p = await contract.getProduct(productId);

  return {
    productId: p.productId || "",
    boxId: p.boxId || "",
    name: p.name || "",
    category: p.category || "",
    manufacturer: p.manufacturer || "",
    manufacturerDate: p.manufacturerDate || "",
    manufacturePlace: p.manufacturePlace || "",
    modelNumber: p.modelNumber || "",
    serialNumber: p.serialNumber || "",
    warrantyPeriod: p.warrantyPeriod || "",
    batchNumber: p.batchNumber || "",
    color: p.color || "",
    specs: p.specs ? JSON.parse(p.specs) : {},
    price: p.price ? p.price.toString() : "0",
    image: p.image || "",
    shipped: Boolean(p.shipped),
    verifiedByRetailer: Boolean(p.verifiedByRetailer),
    sold: Boolean(p.sold)
  };
};
