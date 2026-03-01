import { ethers } from "ethers";
import TrustChainAbi from "./TrustChainAbi.json";

/* ================= CONFIG ================= */

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

/* ================= PROVIDER ================= */

const getProvider = () => {
  if (!window.ethereum) throw new Error("MetaMask not found");
  return new ethers.BrowserProvider(window.ethereum);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const extractErrorReason = (err) =>
  err?.shortMessage ||
  err?.reason ||
  err?.info?.error?.message ||
  err?.error?.message ||
  err?.message ||
  "Unknown blockchain error";

const isNonceConflictError = (reason) => {
  const msg = String(reason || "").toLowerCase();
  return (
    msg.includes("nonce has already been used") ||
    msg.includes("nonce too low") ||
    msg.includes("already known") ||
    msg.includes("replacement transaction underpriced")
  );
};

/* ================= CONTRACT ================= */

const getContract = async () => {
  if (!window.ethereum) throw new Error("MetaMask not found");
  await window.ethereum.request({ method: "eth_requestAccounts" });

  const provider = getProvider();
  const signer = await provider.getSigner();

  return new ethers.Contract(CONTRACT_ADDRESS, TrustChainAbi, signer);
};

const parseProductStart = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const buildProductIds = (startNum, count) =>
  Array.from({ length: count }, (_, i) => `P${startNum + i}`);

const findAvailableStartProductId = async (contract, requestedStart, batchSize) => {
  let start = requestedStart;
  let attempts = 0;

  while (attempts < 20) {
    const ids = buildProductIds(start, batchSize);
    const dup = [];

    for (const id of ids) {
      const existing = await contract.getProduct(id);
      if (existing?.productId && existing.productId.length > 0) dup.push(id);
    }

    if (dup.length === 0) return `P${start}`;

    const maxDup = Math.max(...dup.map((id) => parseProductStart(id)));
    start = maxDup + 1;
    attempts += 1;
  }

  throw new Error("Could not find a free product ID range. Increase start product ID.");
};

const isBatchRegisteredOnChain = async (contract, items) => {
  if (!Array.isArray(items) || items.length === 0) return false;
  const checks = items.slice(0, 2);
  for (const item of checks) {
    const existing = await contract.getProduct(item.productId);
    if (!existing?.productId || existing.productId.length === 0) return false;
  }
  return true;
};

/* ================= WALLET ================= */

export const connectBlockchain = async () => {
  if (!window.ethereum) throw new Error("MetaMask not found");
  await window.ethereum.request({ method: "eth_requestAccounts" });
  console.log("Wallet connected");
};

/* ================= BATCH REGISTER ================= */

export const registerBatch = async (batch) => {
  console.log("Registering batch:", batch.batchId);

  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Login required: token missing. Please sign in again.");
  }

  const safeBatchId = String(batch?.batchId || "").trim();
  const safeBoxId = String(batch?.boxId || "").trim();
  const safeStartRaw = String(batch?.startProductId || "").trim();
  const safeBatchSize = Number(batch?.batchSize || 0);

  if (!safeBatchId) throw new Error("Batch ID is required");
  if (!safeBoxId) throw new Error("Box ID is required");
  if (!safeStartRaw) throw new Error("Start Product ID is required");
  if (!Number.isInteger(safeBatchSize) || safeBatchSize <= 0) {
    throw new Error("Batch size must be a positive integer");
  }

  const contract = await getContract();

  // 1) Find a non-conflicting on-chain product ID range first.
  const requestedStart = parseProductStart(safeStartRaw);
  if (requestedStart === null) {
    throw new Error("Start Product ID must contain a positive number (example: P1001)");
  }
  const safeStartProductId = await findAvailableStartProductId(
    contract,
    requestedStart,
    safeBatchSize
  );

  const payloadBatch = {
    ...batch,
    batchId: safeBatchId,
    boxId: safeBoxId,
    startProductId: safeStartProductId
  };

  // 2) Save/generate batch product data in backend DB.
  const res = await fetch("https://blockchain-li7r.onrender.com/prepare-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payloadBatch)
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const backendMsg = payload?.error || "Failed to prepare batch";
    throw new Error(backendMsg);
  }

  const items = (payload?.items || []).map((item) => ({
    productId: item?.productId ?? "",
    boxId: item?.boxId ?? "",
    name: item?.name ?? "",
    category: item?.category ?? "",
    manufacturer: item?.manufacturer ?? "",
    manufacturerDate: item?.manufacturerDate ?? "",
    manufacturePlace: item?.manufacturePlace ?? "",
    modelNumber: item?.modelNumber ?? "",
    serialNumber: item?.serialNumber ?? "",
    warrantyPeriod: item?.warrantyPeriod ?? "",
    batchNumber: item?.batchNumber ?? "",
    color: item?.color ?? "",
    specs: item?.specs ?? "{}",
    price: item?.price ?? 0,
    image: item?.image ?? ""
  }));
  console.log("Backend prepared batch items for chain registration");

  // 3) Register same products on blockchain in one transaction.
  let chainRegistered = false;
  let txHash = "";
  let lastReason = "Unknown blockchain error";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      if (attempt === 0) {
        const tx = await contract.registerBatchProducts(
          payloadBatch.batchId,
          payloadBatch.boxId,
          items
        );
        txHash = tx.hash || "";
        await tx.wait();
      } else {
        const provider = getProvider();
        const signer = await provider.getSigner();
        const from = await signer.getAddress();
        const nextNonce = await provider.getTransactionCount(from, "pending");
        const freshContract = await getContract();
        const tx = await freshContract.registerBatchProducts(
          payloadBatch.batchId,
          payloadBatch.boxId,
          items,
          { nonce: nextNonce }
        );
        txHash = tx.hash || "";
        await tx.wait();
      }

      chainRegistered = true;
      console.log("Batch registered on blockchain (one tx)");
      break;
    } catch (err) {
      lastReason = extractErrorReason(err);
      const alreadyRegistered = await isBatchRegisteredOnChain(contract, items).catch(() => false);

      if (alreadyRegistered) {
        chainRegistered = true;
        console.log("Batch already present on chain. Skipping duplicate register.");
        break;
      }

      if (!isNonceConflictError(lastReason) || attempt === 1) {
        break;
      }

      await sleep(1200);
    }
  }

  if (!chainRegistered) {
    throw new Error(
      `Blockchain transaction failed: ${lastReason}. Backend was not updated.`
    );
  }

  // 4) Persist batch in DB only after blockchain confirmation.
  const commitRes = await fetch("https://blockchain-li7r.onrender.com/commit-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payloadBatch)
  });
  const commitPayload = await commitRes.json().catch(() => ({}));
  if (!commitRes.ok) {
    throw new Error(
      commitPayload?.error ||
        "Blockchain tx succeeded, but backend commit failed. Please retry commit."
    );
  }

  return { itemsCount: items.length, startProductId: safeStartProductId, txHash };
};

/* ================= SHIP ================= */

const markBoxShippedInBackend = async (boxId) => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("Box shipped on blockchain, but backend sync failed: login token missing.");
  }

  const res = await fetch("https://blockchain-li7r.onrender.com/mark-box-shipped", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ boxId })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Box shipped on blockchain, but backend status update failed.");
  }
};

export const shipBox = async (boxId) => {
  const safeBoxId = String(boxId || "").trim();
  if (!safeBoxId) throw new Error("Box ID is required");

  const contract = await getContract();
  const ids = await contract.getProductsByBox(safeBoxId);
  if (!ids?.length) throw new Error("No products found for this box.");

  // Block duplicate ship attempts.
  let alreadyShipped = false;
  for (const id of ids) {
    const p = await contract.getProduct(id);
    if (p?.shipped) {
      alreadyShipped = true;
      break;
    }
  }
  if (alreadyShipped) {
    // Keep backend status synced if it missed a prior update.
    await markBoxShippedInBackend(safeBoxId).catch(() => {});
    throw new Error(`Box ${safeBoxId} is already shipped.`);
  }

  let shippedOnChain = false;
  let shouldSyncBackend = false;

  try {
    const tx = await contract.shipBox(safeBoxId);
    await tx.wait();
    shippedOnChain = true;
    shouldSyncBackend = true;
  } catch (err) {
    const reason =
      err?.shortMessage ||
      err?.reason ||
      err?.info?.error?.message ||
      err?.error?.message ||
      err?.message ||
      "Unknown blockchain error";

    // If tx failed because already shipped or equivalent, detect shipped state from chain and sync backend.
    try {
      const ids = await contract.getProductsByBox(safeBoxId);
      if (ids?.length > 0) {
        const first = await contract.getProduct(ids[0]);
        if (first?.shipped) shouldSyncBackend = true;
      }
    } catch {
      shouldSyncBackend = false;
    }

    if (!shouldSyncBackend) {
      throw new Error(`Ship transaction failed: ${reason}`);
    }
  }

  await markBoxShippedInBackend(safeBoxId);
  console.log("Box shipped and synced:", safeBoxId, { shippedOnChain });
};

/* ================= BOX QUERY ================= */

export const getProductIdsByBox = async (boxId) => {
  const contract = await getContract();
  const ids = await contract.getProductsByBox(boxId);
  return ids.map((id) => id.toString());
};

/* ================= RETAILER VERIFY ================= */

export const verifyBox = async (boxId) => {
  const safeBoxId = String(boxId || "").trim();
  if (!safeBoxId) throw new Error("Box ID is required");

  const token = localStorage.getItem("token");
  const contract = await getContract();
  let verifiedOnChain = false;
  let shouldSyncBackend = false;

  // Load products for this box.
  const ids = await contract.getProductsByBox(safeBoxId);
  if (!ids?.length) {
    throw new Error("No products found for this box.");
  }
  let alreadyVerified = false;
  for (const id of ids) {
    const p = await contract.getProduct(id);
    if (p?.verifiedByRetailer) alreadyVerified = true;
  }
  if (alreadyVerified) {
    // Keep backend status synced if it missed a prior update.
    if (token) {
      const res = await fetch("https://blockchain-li7r.onrender.com/mark-box-verified", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ boxId: safeBoxId })
      }).catch(() => null);
      if (res && !res.ok) {
        await res.json().catch(() => ({}));
      }
    }
    return { alreadyVerified: true, verifiedOnChain: true, backendSynced: Boolean(token) };
  }

  try {
    const tx = await contract.verifyBox(safeBoxId);
    await tx.wait();
    verifiedOnChain = true;
    shouldSyncBackend = true;
  } catch (err) {
    const reason =
      err?.shortMessage ||
      err?.reason ||
      err?.info?.error?.message ||
      err?.error?.message ||
      err?.message ||
      "Unknown blockchain error";

    // If already verified on-chain, still sync backend.
    try {
      const ids = await contract.getProductsByBox(safeBoxId);
      if (ids?.length > 0) {
        const first = await contract.getProduct(ids[0]);
        if (first?.verifiedByRetailer) shouldSyncBackend = true;
      }
    } catch {
      shouldSyncBackend = false;
    }

    if (!shouldSyncBackend) {
      throw new Error(`Verify box transaction failed: ${reason}`);
    }
  }

  let backendSynced = false;
  if (token) {
    const res = await fetch("https://blockchain-li7r.onrender.com/mark-box-verified", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ boxId: safeBoxId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || "Box verified on blockchain, but backend verify sync failed.");
    }
    backendSynced = true;
  }

  console.log("Box verified and synced:", safeBoxId, { verifiedOnChain });
  return { alreadyVerified: false, verifiedOnChain, backendSynced };
};

export const verifyProduct = async (productId) => {
  const contract = await getContract();
  const tx = await contract.verifyProduct(productId);
  await tx.wait();
  console.log("Product verified:", productId);
};

/* ================= SALE ================= */

export const saleComplete = async (productId) => {
  const safeProductId = String(productId || "").trim();
  if (!safeProductId) throw new Error("Product ID is required");

  const contract = await getContract();

  // Enforce business rule: product can be sold only after shipping + retailer verification.
  const p = await contract.getProduct(safeProductId);
  if (!p?.productId) throw new Error("Product not found");
  if (!p.shipped) throw new Error("Cannot sell before shipping");
  if (!p.verifiedByRetailer) throw new Error("Cannot sell before retailer verification");
  if (p.sold) throw new Error("Product is already sold");

  const tx = await contract.saleComplete(safeProductId);
  await tx.wait();
  console.log("Sold:", safeProductId);
  return { txHash: tx.hash, productId: safeProductId };
};

export const markProductSoldInBackend = async ({ productId, buyerEmail, txHash }) => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Login required: token missing.");

  const safeProductId = String(productId || "").trim();
  const safeBuyerEmail = String(buyerEmail || "").trim();
  if (!safeProductId) throw new Error("Product ID is required.");
  if (!safeBuyerEmail) throw new Error("Buyer email is required.");

  const res = await fetch("https://blockchain-li7r.onrender.com/mark-product-sold", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      productId: safeProductId,
      buyerEmail: safeBuyerEmail,
      txHash: String(txHash || "").trim()
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Sold on-chain, but backend sync/email failed.");
  }
  return data;
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
    // Contract struct has no explicit `registered` field; existence implies registered.
    registered: Boolean(p.productId && String(p.productId).trim().length > 0),
    shipped: Boolean(p.shipped),
    verifiedByRetailer: Boolean(p.verifiedByRetailer),
    sold: Boolean(p.sold)
  };
};

export const getRawProductOnChain = async (productId) => {
  const safeProductId = String(productId || "").trim();
  if (!safeProductId) throw new Error("Product ID is required");

  const contract = await getContract();
  const p = await contract.getProduct(safeProductId);
  if (!p?.productId) throw new Error("Product not found on-chain");

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
    specsRaw: p.specs || "",
    price: p.price ? p.price.toString() : "0",
    image: p.image || "",
    shipped: Boolean(p.shipped),
    verifiedByRetailer: Boolean(p.verifiedByRetailer),
    sold: Boolean(p.sold)
  };
};

export const getRawBoxOnChain = async (boxId) => {
  const safeBoxId = String(boxId || "").trim();
  if (!safeBoxId) throw new Error("Box ID is required");

  const contract = await getContract();
  const ids = await contract.getProductsByBox(safeBoxId);
  const productIds = ids.map((id) => id.toString());

  const products = [];
  for (const id of productIds) {
    const p = await contract.getProduct(id);
    products.push({
      productId: p.productId || id,
      name: p.name || "",
      shipped: Boolean(p.shipped),
      verifiedByRetailer: Boolean(p.verifiedByRetailer),
      sold: Boolean(p.sold)
    });
  }

  return {
    boxId: safeBoxId,
    totalProducts: products.length,
    productIds,
    products
  };
};

export const getRecentHistory = async (manufacturerId) => {
  const token = localStorage.getItem("token");
  const params = new URLSearchParams();
  if (manufacturerId) params.set("manufacturerId", manufacturerId);

  const res = await fetch(`https://blockchain-li7r.onrender.com/recent-history?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error("Failed to load recent history");
  return res.json();
};

export const getBoxDetails = async (boxId) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`https://blockchain-li7r.onrender.com/box-details/${boxId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to fetch box details");
  }
  return res.json();
};

export const getProductDetails = async (productId) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`https://blockchain-li7r.onrender.com/product-details/${productId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to fetch product details");
  }
  return res.json();
};
