import cors from "cors";
import express from "express";
import crypto from "crypto";
import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { signChallenge } from "./nfc_emulator/chip.js";

import { prisma } from "./prismaClient.js";
import { authenticate } from "./middleware/auth.middleware.js";
import authRoutes from "./routes/auth.routes.js";



dotenv.config();

/* ================= PATH UTILS ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= LOAD ABI ================= */

const abiPath = path.join(__dirname, "abi.json");
const abi = JSON.parse(fs.readFileSync(abiPath, "utf-8"));

/* ================= APP SETUP ================= */

const app = express();
const allowedOrigins = ["http://localhost:5173", "http://localhost:5174"];
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());


app.use("/api/auth", authRoutes);

function requireAdmin(req, res, next) {
  const role = String(req.user?.role || "").toUpperCase();
  if (role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
/* ================= BLOCKCHAIN SETUP ================= */

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  abi,
  wallet
);

/* ================= CHALLENGE STORE ================= */

const activeChallenges = new Map();

/* ================= UTILS ================= */

function generateChallenge() {
  return crypto.randomBytes(8).toString("hex");
}

function hashValue(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function sendSaleEmail({ toEmail, details }) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.SALE_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return { sent: false, skipped: true, reason: "Email service not configured" };
  }

  const saleText = [
    "TrustChain Product Purchase Confirmation",
    "",
    `Product ID: ${details.productId}`,
    `Product Name: ${details.name}`,
    `Category: ${details.category}`,
    `Model Number: ${details.modelNumber}`,
    `Serial Number: ${details.serialNumber}`,
    `Batch ID: ${details.batchId}`,
    `Box ID: ${details.boxId}`,
    `Manufacturer ID: ${details.manufacturerId}`,
    `Manufacture Location: ${details.manufacturePlace}`,
    `Retailer ID: ${details.retailerId}`,
    `Retailer Location: ${details.retailerLocation}`,
    `Price: ${details.price}`,
    `Transaction Hash: ${details.txHash || "-"}`,
    `Sale Time: ${details.soldAt}`,
    "",
    "This item has been marked as sold on TrustChain."
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>TrustChain Product Purchase Confirmation</h2>
      <p>This product has been marked as sold.</p>
      <table style="border-collapse: collapse;">
        ${Object.entries(details)
          .map(
            ([k, v]) =>
              `<tr><td style="padding:4px 10px 4px 0;font-weight:700;">${k}</td><td style="padding:4px 0;">${String(v ?? "-")}</td></tr>`
          )
          .join("")}
      </table>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject: `TrustChain Sale Confirmation - ${details.productId}`,
      text: saleText,
      html
    })
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    return { sent: false, skipped: false, reason: errBody || "Email send failed" };
  }

  return { sent: true, skipped: false };
}

/* =====================================================
   0ï¸âƒ£ STORE NFC SECRET (manufacturing time)
   ===================================================== */



/* =====================================================
   1ï¸âƒ£ CHALLENGE ENDPOINT
   ===================================================== */

app.post("/challenge", async (req, res) => {
  try {
    const { productId } = req.body;

    console.log("ðŸ” /challenge request:", productId);

    if (!productId) {
      return res.status(400).json({ error: "productId required" });
    }

    let product;
    try {
      product = await contract.getProduct(productId);
    } catch (bcErr) {
      console.error("âŒ Blockchain error:", bcErr);
      return res.status(500).json({ error: "Blockchain read failed" });
    }

    // ðŸ” SAFETY CHECK
    if (!product || !product.productId || product.productId.length === 0) {
      return res.json({ status: "FAKE", reason: "Not registered" });
    }

    if (!product.shipped || !product.verifiedByRetailer) {
      return res.json({ status: "NOT_READY" });
    }

    const challenge = generateChallenge();
    activeChallenges.set(productId, challenge);

    console.log("âœ… Challenge issued:", challenge);
    res.json({ challenge });

  } catch (err) {
    console.error("ðŸ”¥ Challenge error:", err);
    res.status(500).json({ error: "Challenge generation failed" });
  }
});

app.post("/nfc/sign", async (req, res) => {
  try {
    const { productId, challenge } = req.body;

    console.log("ðŸ“¡ /nfc/sign called");
    console.log("Body:", req.body);

    if (!productId || !challenge) {
      return res.status(400).json({
        error: "productId & challenge required"
      });
    }

    const response = await signChallenge(productId, challenge);

    res.json({ response });

  } catch (err) {
    console.error("âŒ NFC SIGN ERROR:", err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post("/prepare-batch", authenticate, async (req, res) => {
  try {
    const batch = req.body;
    const batchId = String(batch.batchId || "").trim();
    const boxId = String(batch.boxId || "").trim();
    const startProductId = String(batch.startProductId || "").trim();
    const productName = String(batch.name || "").trim();
    const categoryValue = String(batch.category || "").trim();
    const manufacturerIdValue = String(batch.manufacturerId || batch.manufacturer || "").trim();
    const manufacturePlaceValue = String(batch.manufacturePlace || "").trim();
    const modelNumberValue = String(batch.modelNumber || "").trim();
    const warrantyPeriodValue = String(batch.warrantyPeriod || "").trim();
    const colorValue = String(batch.color || "").trim();
    const retailerIdValue = String(batch.retailerName || "").trim();
    const retailerLocationValue = String(batch.retailerLocation || "").trim();

    if (!batchId) return res.status(400).json({ error: "Batch ID is required" });
    if (!boxId) return res.status(400).json({ error: "Box ID is required" });
    if (!startProductId) return res.status(400).json({ error: "Start Product ID is required" });
    if (!productName) return res.status(400).json({ error: "Product name is required" });
    if (!categoryValue) return res.status(400).json({ error: "Category is required" });
    if (!manufacturerIdValue) return res.status(400).json({ error: "Manufacturer ID is required" });
    if (!manufacturePlaceValue) return res.status(400).json({ error: "Manufacture place is required" });
    if (!modelNumberValue) return res.status(400).json({ error: "Model number is required" });
    if (!warrantyPeriodValue) return res.status(400).json({ error: "Warranty period is required" });
    if (!colorValue) return res.status(400).json({ error: "Color is required" });
    if (!retailerIdValue) return res.status(400).json({ error: "Retailer name is required" });
    if (!retailerLocationValue) return res.status(400).json({ error: "Retailer location is required" });

    const startNum = parseInt(
      startProductId.replace(/\D/g, ""),
      10
    );
    if (!Number.isFinite(startNum) || startNum <= 0) {
      return res.status(400).json({
        error: "Start Product ID must contain a positive number (example: P1001)"
      });
    }
    const safeStartNum = startNum;
    const batchSizeRaw = Number(batch.batchSize);
    if (!Number.isInteger(batchSizeRaw) || batchSizeRaw <= 0) {
      return res.status(400).json({
        error: "Batch size is required and must be a positive integer"
      });
    }
    const batchSize = batchSizeRaw;

    const price = Number(batch.price);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({
        error: "Price is required and must be greater than 0"
      });
    }

    const parsedDate = batch.manufacturerDate ? new Date(batch.manufacturerDate) : null;
    const mfgDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
    if (!mfgDate) {
      return res.status(400).json({
        error: "Manufacturer date is required and must be valid"
      });
    }

    const [existingBox, existingBoxSecret, existingPreparedBox] = await Promise.all([
      prisma.box.findUnique({ where: { boxCode: boxId }, select: { boxCode: true } }),
      prisma.boxSecret.findUnique({ where: { boxId }, select: { boxId: true } }),
      prisma.preparedProduct.findFirst({ where: { boxId }, select: { boxId: true } })
    ]);
    if (existingBox || existingBoxSecret || existingPreparedBox) {
      return res.status(409).json({
        error: `Box ID already exists: ${boxId}. Box ID must be unique.`
      });
    }

    const productIds = [];
    for (let i = 0; i < batchSize; i += 1) {
      productIds.push(`P${safeStartNum + i}`);
    }

    const uniqueProductIds = new Set(productIds);
    if (uniqueProductIds.size !== productIds.length) {
      return res.status(400).json({ error: "Duplicate Product IDs in batch request" });
    }

    const [existingPrepared, existingProducts, existingSecrets] = await Promise.all([
      prisma.preparedProduct.findMany({
        where: { productId: { in: productIds } },
        select: { productId: true }
      }),
      prisma.product.findMany({
        where: { productCode: { in: productIds } },
        select: { productCode: true }
      }),
      prisma.productSecret.findMany({
        where: { productId: { in: productIds } },
        select: { productId: true }
      })
    ]);

    const taken = new Set([
      ...existingPrepared.map((x) => x.productId),
      ...existingProducts.map((x) => x.productCode),
      ...existingSecrets.map((x) => x.productId)
    ]);

    if (taken.size > 0) {
      return res.status(409).json({
        error: `Product IDs already exist: ${Array.from(taken).sort().join(", ")}`
      });
    }

    // Ensure manufacturer profile exists for relational Batch/Box/Product tables.
    const manufacturer = await prisma.manufacturer.upsert({
      where: { userId: req.user.userId },
      update: {
        name: manufacturerIdValue
      },
      create: {
        userId: req.user.userId,
        name: manufacturerIdValue
      }
    });

    // Upsert summary-level Batch + Box rows.
    const batchRow = await prisma.batch.upsert({
      where: { batchCode: batchId },
      update: {
        manufacturerId: manufacturer.id,
        boxCode: boxId,
        totalBoxes: 1,
        totalProducts: batchSize,
        registered: true
      },
      create: {
        batchCode: batchId,
        boxCode: boxId,
        manufacturerId: manufacturer.id,
        totalBoxes: 1,
        totalProducts: batchSize,
        registered: true
      }
    });

    const boxRow = await prisma.box.upsert({
      where: { boxCode: boxId },
      update: {
        batchId: batchRow.id,
        totalProducts: batchSize,
        manufacturerId: manufacturerIdValue,
        manufactureLocation: manufacturePlaceValue,
        retailerId: retailerIdValue,
        retailerLocation: retailerLocationValue,
        registered: true
      },
      create: {
        boxCode: boxId,
        batchId: batchRow.id,
        totalProducts: batchSize,
        manufacturerId: manufacturerIdValue,
        manufactureLocation: manufacturePlaceValue,
        retailerId: retailerIdValue,
        retailerLocation: retailerLocationValue,
        registered: true
      }
    });

    const batchSecret = crypto.randomBytes(32).toString("hex");
    const boxSecret = hashValue(`${batchSecret}:${boxId}`);

    await prisma.boxSecret.upsert({
      where: { boxId },
      update: { secret: boxSecret },
      create: { boxId, secret: boxSecret }
    });

    const items = [];

    for (let i = 0; i < batchSize; i++) {
      const productId = productIds[i];
      const serialNumber = `${batchId}-SN-${i + 1}`;

      const productSecret = hashValue(`${productId}:${boxId}:${boxSecret}`);

      // Store in DB. Use create to enforce uniqueness and block silent overwrite.
      await prisma.productSecret.create({
        data: { productId, secret: productSecret }
      });

      await prisma.preparedProduct.create({
        data: {
          productId,
          batchId,
          boxId,
          serialNumber,
          name: productName,
          category: categoryValue,
          manufacturer: manufacturerIdValue,
          manufacturerDate: batch.manufacturerDate || "",
          manufacturePlace: manufacturePlaceValue,
          modelNumber: modelNumberValue,
          warrantyPeriod: warrantyPeriodValue,
          color: colorValue,
          specs: JSON.stringify({ batch: batchId }),
          price,
          image: batch.image || "/mob.jpg",
          retailerName: retailerIdValue,
          retailerLocation: retailerLocationValue,
          registered: true
        }
      });

      // Store full product details in relational Product table.
      await prisma.product.create({
        data: {
          productCode: productId,
          batchId: batchRow.id,
          boxId: boxRow.id,
          name: productName,
          brand: manufacturerIdValue || "TrustChain",
          category: categoryValue,
          modelNumber: modelNumberValue,
          serialNumber,
          warrantyPeriod: warrantyPeriodValue,
          color: colorValue,
          price,
          image: batch.image || "/mob.jpg",
          retailerId: retailerIdValue,
          retailerLocation: retailerLocationValue,
          mfgDate,
          registered: true
        }
      });

      items.push({
        productId,
        boxId,
        name: productName,
        category: categoryValue,
        manufacturer: manufacturerIdValue,
        manufacturerDate: batch.manufacturerDate,
        manufacturePlace: manufacturePlaceValue,
        modelNumber: modelNumberValue,
        serialNumber,
        warrantyPeriod: warrantyPeriodValue,
        batchNumber: batchId,
        color: colorValue,
        specs: JSON.stringify({ batch: batchId }),
        price,
        image: batch.image || "/mob.jpg"
      });
    }

    console.log("âœ… Batch prepared with secrets and details stored in DB");

    res.json({ items });

  } catch (err) {
    console.error("âŒ Batch preparation failed:", err);
    res.status(500).json({ error: err?.message || "Batch preparation failed" });
  }
});

app.get("/recent-history", authenticate, async (req, res) => {
  try {
    const manufacturerId = String(req.query.manufacturerId || "").trim();
    const where = manufacturerId ? { manufacturer: manufacturerId } : {};

    const [products, boxes] = await Promise.all([
      prisma.preparedProduct.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          productId: true,
          batchId: true,
          boxId: true,
          name: true,
          createdAt: true
        }
      }),
      prisma.box.findMany({
        where: {
          batch: {
            manufacturer: {
              userId: req.user.userId
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          boxCode: true,
          totalProducts: true,
          shipped: true,
          createdAt: true
        }
      })
    ]);

    res.json({ products, boxes });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to fetch recent history" });
  }
});

app.get("/box-details/:boxId", authenticate, async (req, res) => {
  try {
    const { boxId } = req.params;
    const [box, boxSecretRow] = await Promise.all([
      prisma.box.findUnique({
        where: { boxCode: boxId },
        include: { batch: true }
      }),
      prisma.boxSecret.findUnique({
        where: { boxId }
      })
    ]);

    if (!box) {
      return res.status(404).json({ error: "Box not found" });
    }

    const prepared = await prisma.preparedProduct.findMany({
      where: { boxId },
      orderBy: { createdAt: "asc" },
      select: {
        productId: true,
        batchId: true,
        manufacturer: true,
        manufacturePlace: true,
        retailerName: true,
        retailerLocation: true
      }
    });

    const preparedRetailerId =
      prepared.find((p) => String(p.retailerName || "").trim())?.retailerName || "";
    const preparedRetailerLocation =
      prepared.find((p) => String(p.retailerLocation || "").trim())?.retailerLocation || "";

    let boxSecret = boxSecretRow?.secret || "";
    if (!boxSecret) {
      boxSecret = hashValue(`legacy:${box.boxCode}:${box.batch.batchCode}`);
      await prisma.boxSecret.upsert({
        where: { boxId: box.boxCode },
        update: { secret: boxSecret },
        create: { boxId: box.boxCode, secret: boxSecret }
      });
    }

    const qrPayload = boxSecret ? `boxId=${box.boxCode}|secret=${boxSecret}` : "";
    const qrImageUrl = qrPayload
      ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrPayload)}`
      : "";

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { email: true, role: true }
    });
    const viewerRetailerEmail =
      currentUser?.role === "RETAILER"
        ? String(currentUser?.email || "").trim()
        : "";

    res.json({
      boxId: box.boxCode,
      batchId: box.batch.batchCode,
      totalProducts: box.totalProducts,
      manufacturerId: box.manufacturerId || prepared[0]?.manufacturer || "",
      manufactureLocation: box.manufactureLocation || prepared[0]?.manufacturePlace || "",
      retailerId: viewerRetailerEmail || box.retailerId || preparedRetailerId || "",
      retailerLocation: box.retailerLocation || preparedRetailerLocation || "",
      registered: box.registered,
      verified: box.verified,
      shipped: box.shipped,
      productIds: prepared.map((p) => p.productId),
      boxSecret,
      qrImageUrl
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to fetch box details" });
  }
});

app.get("/product-details/:productId", authenticate, async (req, res) => {
  try {
    const { productId } = req.params;
    const [prepared, product, secretRow] = await Promise.all([
      prisma.preparedProduct.findUnique({ where: { productId } }),
      prisma.product.findUnique({
        where: { productCode: productId },
        include: { batch: true, box: true }
      }),
      prisma.productSecret.findUnique({ where: { productId } })
    ]);

    if (!prepared && !product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Auto-heal DB status from blockchain to prevent stale sold/verified/shipped flags.
    let chainFlags = null;
    try {
      const chainProduct = await contract.getProduct(productId);
      if (chainProduct?.productId) {
        chainFlags = {
          shipped: Boolean(chainProduct.shipped),
          verified: Boolean(chainProduct.verifiedByRetailer),
          sold: Boolean(chainProduct.sold)
        };
      }
    } catch {
      chainFlags = null;
    }

    const dbShipped = Boolean(prepared?.shipped ?? product?.shipped ?? false);
    const dbVerified = Boolean(prepared?.verified ?? product?.verified ?? false);
    const dbSold = Boolean(prepared?.sold ?? product?.sold ?? false);

    const shipped = Boolean(dbShipped || chainFlags?.shipped);
    const verified = Boolean(dbVerified || chainFlags?.verified);
    const sold = Boolean(dbSold || chainFlags?.sold);

    const needsPreparedSync =
      !!prepared &&
      (prepared.shipped !== shipped || prepared.verified !== verified || prepared.sold !== sold);
    const needsProductSync =
      !!product &&
      (product.shipped !== shipped || product.verified !== verified || product.sold !== sold);

    if (needsPreparedSync || needsProductSync) {
      const updates = [];
      if (needsPreparedSync) {
        updates.push(
          prisma.preparedProduct.updateMany({
            where: { productId },
            data: { shipped, verified, sold }
          })
        );
      }
      if (needsProductSync) {
        updates.push(
          prisma.product.updateMany({
            where: { productCode: productId },
            data: { shipped, verified, sold, status: sold ? "SOLD" : shipped ? "SHIPPED" : "CREATED" }
          })
        );
      }
      if (updates.length > 0) {
        await prisma.$transaction(updates);
      }
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { email: true, role: true }
    });
    const viewerRetailerEmail =
      currentUser?.role === "RETAILER"
        ? String(currentUser?.email || "").trim()
        : "";

    res.json({
      productId,
      name: prepared?.name || product?.name || "",
      batchId: prepared?.batchId || product?.batch?.batchCode || "",
      boxId: prepared?.boxId || product?.box?.boxCode || "",
      manufacturerId: prepared?.manufacturer || product?.brand || "",
      manufacturerDate: prepared?.manufacturerDate || (product?.mfgDate ? product.mfgDate.toISOString().slice(0, 10) : ""),
      manufacturePlace: prepared?.manufacturePlace || product?.box?.manufactureLocation || "",
      modelNumber: prepared?.modelNumber || product?.modelNumber || "",
      serialNumber: prepared?.serialNumber || product?.serialNumber || "",
      warrantyPeriod: prepared?.warrantyPeriod || product?.warrantyPeriod || "",
      color: prepared?.color || product?.color || "",
      price: prepared?.price ?? product?.price ?? 0,
      image: prepared?.image || product?.image || "/mob.jpg",
      retailerId:
        viewerRetailerEmail ||
        prepared?.retailerName ||
        product?.retailerId ||
        product?.box?.retailerId ||
        "",
      retailerLocation: prepared?.retailerLocation || product?.retailerLocation || product?.box?.retailerLocation || "",
      productSecret: secretRow?.secret || "",
      registered: prepared?.registered ?? product?.registered ?? false,
      verified,
      shipped,
      sold
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to fetch product details" });
  }
});

app.post("/mark-box-shipped", authenticate, async (req, res) => {
  try {
    const { boxId } = req.body;
    if (!boxId) {
      return res.status(400).json({ error: "boxId is required" });
    }

    const box = await prisma.box.findUnique({
      where: { boxCode: boxId },
      include: { batch: true }
    });
    if (!box) return res.status(404).json({ error: "Box not found" });

    const ids = await prisma.preparedProduct.findMany({
      where: { boxId },
      select: { productId: true }
    });
    const productCodes = ids.map((x) => x.productId);

    await prisma.$transaction([
      prisma.preparedProduct.updateMany({
        where: { boxId },
        data: { shipped: true }
      }),
      prisma.product.updateMany({
        where: { productCode: { in: productCodes } },
        data: { shipped: true, status: "SHIPPED" }
      }),
      prisma.box.update({
        where: { boxCode: boxId },
        data: { shipped: true }
      }),
      prisma.batch.update({
        where: { id: box.batchId },
        data: { shipped: true }
      })
    ]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to update shipped status" });
  }
});

app.post("/mark-box-verified", authenticate, async (req, res) => {
  try {
    const { boxId } = req.body;
    if (!boxId) {
      return res.status(400).json({ error: "boxId is required" });
    }

    const box = await prisma.box.findUnique({
      where: { boxCode: boxId },
      include: { batch: true }
    });
    if (!box) return res.status(404).json({ error: "Box not found" });
    if (!box.shipped) {
      return res.status(400).json({ error: "Cannot verify before shipping" });
    }

    const ids = await prisma.preparedProduct.findMany({
      where: { boxId },
      select: { productId: true }
    });
    const productCodes = ids.map((x) => x.productId);

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { email: true, role: true }
    });
    const retailerEmail =
      currentUser?.role === "RETAILER"
        ? String(currentUser?.email || "").trim()
        : "";

    await prisma.$transaction([
      prisma.preparedProduct.updateMany({
        where: { boxId },
        data: retailerEmail
          ? { verified: true, retailerName: retailerEmail }
          : { verified: true }
      }),
      prisma.product.updateMany({
        where: { productCode: { in: productCodes } },
        data: retailerEmail
          ? { verified: true, retailerId: retailerEmail }
          : { verified: true }
      }),
      prisma.box.update({
        where: { boxCode: boxId },
        data: retailerEmail
          ? { verified: true, retailerId: retailerEmail }
          : { verified: true }
      }),
      prisma.batch.update({
        where: { id: box.batchId },
        data: { verified: true }
      })
    ]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to update verified status" });
  }
});

app.post("/mark-product-sold", authenticate, async (req, res) => {
  try {
    const { productId, buyerEmail, txHash } = req.body;
    const pid = String(productId || "").trim();
    const email = String(buyerEmail || "").trim();

    if (!pid) return res.status(400).json({ error: "productId is required" });
    if (!email) return res.status(400).json({ error: "buyerEmail is required" });
    if (!isValidEmail(email)) return res.status(400).json({ error: "Invalid buyerEmail" });

    const [prepared, product] = await Promise.all([
      prisma.preparedProduct.findUnique({ where: { productId: pid } }),
      prisma.product.findUnique({
        where: { productCode: pid },
        include: { batch: true, box: true }
      })
    ]);

    if (!prepared && !product) {
      return res.status(404).json({ error: "Product not found" });
    }

    await prisma.$transaction([
      prisma.preparedProduct.updateMany({
        where: { productId: pid },
        data: { sold: true }
      }),
      prisma.product.updateMany({
        where: { productCode: pid },
        data: { sold: true, status: "SOLD" }
      })
    ]);

    const soldAt = new Date().toISOString();
    const saleDetails = {
      productId: pid,
      name: prepared?.name || product?.name || "",
      category: prepared?.category || product?.category || "",
      modelNumber: prepared?.modelNumber || product?.modelNumber || "",
      serialNumber: prepared?.serialNumber || product?.serialNumber || "",
      batchId: prepared?.batchId || product?.batch?.batchCode || "",
      boxId: prepared?.boxId || product?.box?.boxCode || "",
      manufacturerId: prepared?.manufacturer || product?.brand || "",
      manufacturePlace: prepared?.manufacturePlace || product?.box?.manufactureLocation || "",
      retailerId: prepared?.retailerName || product?.retailerId || product?.box?.retailerId || "",
      retailerLocation:
        prepared?.retailerLocation || product?.retailerLocation || product?.box?.retailerLocation || "",
      price: prepared?.price ?? product?.price ?? 0,
      txHash: String(txHash || "").trim() || "-",
      soldAt
    };

    const emailResult = await sendSaleEmail({
      toEmail: email,
      details: saleDetails
    });

    res.json({
      success: true,
      productId: pid,
      buyerEmail: email,
      sale: saleDetails,
      email: emailResult
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to mark product sold" });
  }
});

app.get("/admin/overview", authenticate, requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalBatches,
      totalBoxes,
      totalProducts,
      totalPreparedProducts,
      registeredProducts,
      registeredPreparedProducts,
      soldProducts,
      soldPreparedProducts,
      verifiedProducts,
      verifiedPreparedProducts,
      shippedProducts,
      shippedPreparedProducts,
      pendingProducts,
      pendingPreparedProducts,
      roleCounts,
      latestProducts
    ] = await Promise.all([
      prisma.user.count(),
      prisma.batch.count(),
      prisma.box.count(),
      prisma.product.count(),
      prisma.preparedProduct.count(),
      prisma.product.count({ where: { registered: true } }),
      prisma.preparedProduct.count({ where: { registered: true } }),
      prisma.product.count({ where: { sold: true } }),
      prisma.preparedProduct.count({ where: { sold: true } }),
      prisma.product.count({ where: { verified: true } }),
      prisma.preparedProduct.count({ where: { verified: true } }),
      prisma.product.count({ where: { shipped: true } }),
      prisma.preparedProduct.count({ where: { shipped: true } }),
      prisma.product.count({
        where: {
          shipped: false,
          verified: false,
          sold: false
        }
      }),
      prisma.preparedProduct.count({
        where: {
          shipped: false,
          verified: false,
          sold: false
        }
      }),
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.product.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          productCode: true,
          name: true,
          retailerId: true,
          retailerLocation: true,
          shipped: true,
          verified: true,
          sold: true,
          createdAt: true
        }
      })
    ]);

    const latestPreparedProducts =
      latestProducts.length > 0
        ? []
        : await prisma.preparedProduct.findMany({
            orderBy: { createdAt: "desc" },
            take: 12,
            select: {
              productId: true,
              name: true,
              retailerName: true,
              retailerLocation: true,
              shipped: true,
              verified: true,
              sold: true,
              createdAt: true
            }
          });

    const resolvedTotalProducts = totalProducts > 0 ? totalProducts : totalPreparedProducts;
    const resolvedRegistered = registeredProducts > 0 ? registeredProducts : registeredPreparedProducts;
    const resolvedSold = soldProducts > 0 ? soldProducts : soldPreparedProducts;
    const resolvedVerified = verifiedProducts > 0 ? verifiedProducts : verifiedPreparedProducts;
    const resolvedShipped = shippedProducts > 0 ? shippedProducts : shippedPreparedProducts;
    const resolvedPending = pendingProducts > 0 ? pendingProducts : pendingPreparedProducts;

    const roleMap = { admin: 0, manufacturer: 0, retailer: 0, user: 0 };
    roleCounts.forEach((r) => {
      const key = String(r.role || "").toLowerCase();
      roleMap[key] = r._count._all;
    });

    res.json({
      totals: {
        totalUsers,
        totalBatches,
        totalBoxes,
        totalProducts: resolvedTotalProducts,
        registeredProducts: resolvedRegistered,
        soldProducts: resolvedSold,
        verifiedProducts: resolvedVerified,
        shippedProducts: resolvedShipped,
        pendingProducts: resolvedPending
      },
      roles: roleMap,
      recentHistory:
        latestProducts.length > 0
          ? latestProducts.map((p) => ({
              productId: p.productCode,
              name: p.name,
              retailerId: p.retailerId || "-",
              retailerLocation: p.retailerLocation || "-",
              shipped: p.shipped,
              verified: p.verified,
              sold: p.sold,
              createdAt: p.createdAt
            }))
          : latestPreparedProducts.map((p) => ({
              productId: p.productId,
              name: p.name,
              retailerId: p.retailerName || "-",
              retailerLocation: p.retailerLocation || "-",
              shipped: p.shipped,
              verified: p.verified,
              sold: p.sold,
              createdAt: p.createdAt
            }))
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to fetch admin overview" });
  }
});

app.get("/admin/users", authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        manufacturer: { select: { name: true } },
        retailer: { select: { name: true } }
      }
    });

    res.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        profileName: u.manufacturer?.name || u.retailer?.name || ""
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to fetch users" });
  }
});

app.patch("/admin/users/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid user id" });

    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: "User not found" });

    const nextEmail = String(req.body?.email || current.email).trim();
    const nextRole = String(req.body?.role || current.role).trim().toUpperCase();
    const nextName = String(req.body?.profileName || nextEmail).trim() || nextEmail;
    const validRoles = ["ADMIN", "MANUFACTURER", "RETAILER", "USER"];
    if (!validRoles.includes(nextRole)) return res.status(400).json({ error: "Invalid role" });

    const updated = await prisma.user.update({
      where: { id },
      data: { email: nextEmail, role: nextRole }
    });

    if (nextRole === "MANUFACTURER") {
      await prisma.manufacturer.upsert({
        where: { userId: id },
        update: { name: nextName },
        create: { userId: id, name: nextName }
      });
    } else if (nextRole === "RETAILER") {
      await prisma.retailer.upsert({
        where: { userId: id },
        update: { name: nextName },
        create: { userId: id, name: nextName }
      });
    }

    res.json({
      id: updated.id,
      email: updated.email,
      role: updated.role
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to update user" });
  }
});

app.delete("/admin/users/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid user id" });

    if (Number(req.user?.userId) === id) {
      return res.status(400).json({ error: "You cannot delete your own admin account" });
    }

    const current = await prisma.user.findUnique({
      where: { id },
      include: {
        manufacturer: { select: { id: true } },
        retailer: { select: { id: true } }
      }
    });
    if (!current) return res.status(404).json({ error: "User not found" });

    if (String(current.role || "").toUpperCase() === "ADMIN") {
      return res.status(400).json({ error: "Admin accounts cannot be deleted from dashboard" });
    }

    if (current.manufacturer?.id) {
      const manufacturerBatchCount = await prisma.batch.count({
        where: { manufacturerId: current.manufacturer.id }
      });
      if (manufacturerBatchCount > 0) {
        return res.status(409).json({
          error: "Cannot delete manufacturer with existing batches/products"
        });
      }
    }

    const tx = [];
    if (current.manufacturer?.id) {
      tx.push(prisma.manufacturer.delete({ where: { userId: id } }));
    }
    if (current.retailer?.id) {
      tx.push(prisma.retailer.delete({ where: { userId: id } }));
    }
    tx.push(prisma.user.delete({ where: { id } }));

    await prisma.$transaction(tx);

    res.json({ success: true, deletedUserId: id });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to delete user" });
  }
});

app.get("/admin/products", authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit || 200), 500));
    const products = await prisma.product.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        batch: { select: { batchCode: true } },
        box: { select: { boxCode: true, manufacturerId: true, manufactureLocation: true } }
      }
    });
    if (products.length > 0) {
      return res.json(
        products.map((p) => ({
          productId: p.productCode,
          name: p.name,
          category: p.category,
          modelNumber: p.modelNumber,
          serialNumber: p.serialNumber,
          warrantyPeriod: p.warrantyPeriod,
          color: p.color,
          price: p.price,
          image: p.image,
          batchId: p.batch?.batchCode || "",
          boxId: p.box?.boxCode || "",
          manufacturer: p.brand || p.box?.manufacturerId || "",
          manufacturePlace: p.box?.manufactureLocation || "",
          retailerId: p.retailerId || "",
          retailerLocation: p.retailerLocation || "",
          registered: p.registered,
          shipped: p.shipped,
          verified: p.verified,
          sold: p.sold,
          createdAt: p.createdAt
        }))
      );
    }

    const preparedProducts = await prisma.preparedProduct.findMany({
      take: limit,
      orderBy: { createdAt: "desc" }
    });

    res.json(
      preparedProducts.map((p) => ({
        productId: p.productId,
        name: p.name,
        category: p.category,
        modelNumber: p.modelNumber,
        serialNumber: p.serialNumber,
        warrantyPeriod: p.warrantyPeriod,
        color: p.color,
        price: p.price,
        image: p.image,
        batchId: p.batchId || "",
        boxId: p.boxId || "",
        manufacturer: p.manufacturer || "",
        manufacturePlace: p.manufacturePlace || "",
        retailerId: p.retailerName || "",
        retailerLocation: p.retailerLocation || "",
        registered: p.registered,
        shipped: p.shipped,
        verified: p.verified,
        sold: p.sold,
        createdAt: p.createdAt
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to fetch products" });
  }
});

app.patch("/admin/products/:productId", authenticate, requireAdmin, async (req, res) => {
  try {
    const productId = String(req.params.productId || "").trim();
    if (!productId) return res.status(400).json({ error: "productId is required" });

    const current = await prisma.product.findUnique({ where: { productCode: productId } });
    const currentPrepared = await prisma.preparedProduct.findUnique({ where: { productId } });
    if (!current && !currentPrepared) return res.status(404).json({ error: "Product not found" });

    const body = req.body || {};
    const shipped = body.shipped === undefined ? Boolean(current?.shipped ?? currentPrepared?.shipped) : Boolean(body.shipped);
    const verified = body.verified === undefined ? Boolean(current?.verified ?? currentPrepared?.verified) : Boolean(body.verified);
    const sold = body.sold === undefined ? Boolean(current?.sold ?? currentPrepared?.sold) : Boolean(body.sold);

    const updateData = {
      name: body.name ?? current?.name ?? currentPrepared?.name ?? "",
      category: body.category ?? current?.category ?? currentPrepared?.category ?? "",
      modelNumber: body.modelNumber ?? current?.modelNumber ?? currentPrepared?.modelNumber ?? "",
      serialNumber: body.serialNumber ?? current?.serialNumber ?? currentPrepared?.serialNumber ?? "",
      warrantyPeriod: body.warrantyPeriod ?? current?.warrantyPeriod ?? currentPrepared?.warrantyPeriod ?? "",
      color: body.color ?? current?.color ?? currentPrepared?.color ?? "",
      price: body.price === undefined ? Number(current?.price ?? currentPrepared?.price ?? 0) : Number(body.price || 0),
      retailerId: body.retailerId ?? current?.retailerId ?? currentPrepared?.retailerName ?? "",
      retailerLocation: body.retailerLocation ?? current?.retailerLocation ?? currentPrepared?.retailerLocation ?? "",
      shipped,
      verified,
      sold,
      status: sold ? "SOLD" : shipped ? "SHIPPED" : "CREATED"
    };

    const tx = [];
    if (current) {
      tx.push(
        prisma.product.update({
          where: { productCode: productId },
          data: updateData
        })
      );
    }
    tx.push(
      prisma.preparedProduct.updateMany({
        where: { productId },
        data: {
          name: updateData.name,
          category: updateData.category,
          modelNumber: updateData.modelNumber || "",
          serialNumber: updateData.serialNumber || "",
          warrantyPeriod: updateData.warrantyPeriod || "",
          color: updateData.color || "",
          price: updateData.price,
          retailerName: updateData.retailerId || "",
          retailerLocation: updateData.retailerLocation || "",
          shipped,
          verified,
          sold
        }
      })
    );

    await prisma.$transaction(tx);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to update product" });
  }
});

app.get("/admin/sales-analytics", authenticate, requireAdmin, async (req, res) => {
  try {
    const range = String(req.query.range || "week").toLowerCase();
    const days = range === "month" ? 30 : 7;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));

    const soldProducts = await prisma.product.findMany({
      where: {
        sold: true,
        createdAt: { gte: from }
      },
      select: {
        createdAt: true,
        retailerLocation: true
      }
    });

    const soldPreparedProducts =
      soldProducts.length > 0
        ? []
        : await prisma.preparedProduct.findMany({
            where: {
              sold: true,
              createdAt: { gte: from }
            },
            select: {
              createdAt: true,
              retailerLocation: true
            }
          });

    const salesRows = soldProducts.length > 0 ? soldProducts : soldPreparedProducts;

    const dayMap = new Map();
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      dayMap.set(d.toISOString().slice(0, 10), 0);
    }
    salesRows.forEach((p) => {
      const key = p.createdAt.toISOString().slice(0, 10);
      dayMap.set(key, (dayMap.get(key) || 0) + 1);
    });
    const daily = Array.from(dayMap.entries()).map(([date, soldCount]) => ({ date, soldCount }));

    const areaMap = new Map();
    salesRows.forEach((p) => {
      const area = String(p.retailerLocation || "Unknown").trim() || "Unknown";
      areaMap.set(area, (areaMap.get(area) || 0) + 1);
    });
    const byArea = Array.from(areaMap.entries())
      .map(([area, soldCount]) => ({ area, soldCount }))
      .sort((a, b) => b.soldCount - a.soldCount)
      .slice(0, 8);

    res.json({
      range,
      from,
      to: new Date(),
      daily,
      byArea
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to fetch sales analytics" });
  }
});

app.get("/admin/blockchain-blocks", authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit || 12), 30));
    const latestBlockNumber = await provider.getBlockNumber();
    const blockNumbers = [];
    for (let i = 0; i < limit; i++) {
      const n = latestBlockNumber - i;
      if (n < 0) break;
      blockNumbers.push(n);
    }

    const blocks = await Promise.all(
      blockNumbers.map(async (n) => {
        const b = await provider.getBlock(n, false);
        return {
          blockNumber: b?.number ?? n,
          hash: b?.hash || "",
          parentHash: b?.parentHash || "",
          timestamp: b?.timestamp ? new Date(Number(b.timestamp) * 1000).toISOString() : null,
          txCount: Array.isArray(b?.transactions) ? b.transactions.length : 0,
          nonce: b?.nonce ? String(b.nonce) : "",
          gasUsed: b?.gasUsed ? b.gasUsed.toString() : "0",
          gasLimit: b?.gasLimit ? b.gasLimit.toString() : "0"
        };
      })
    );

    res.json({
      latestBlockNumber,
      totalBlocks: blocks.length,
      blocks
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to fetch blockchain blocks" });
  }
});





/* =====================================================
   2ï¸âƒ£ VERIFY ENDPOINT
   ===================================================== */

app.post("/verify", async (req, res) => {
  try {
    const { productId, response } = req.body;

    console.log("ðŸ” /verify request:", productId);

    if (!productId || !response) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const challenge = activeChallenges.get(productId);

    if (!challenge) {
      return res.json({ status: "FAILED", reason: "No active challenge" });
    }

    let expected;
    try {
      expected = await signChallenge(productId, challenge);
    } catch (nfcErr) {
      console.error("âŒ NFC error:", nfcErr);
      return res.json({ status: "FAKE" });
    }

    activeChallenges.delete(productId); // one-time use

    if (expected !== response) {
      return res.json({ status: "FAKE" });
    }

    const product = await contract.getProduct(productId);

    res.json({
      status: "GENUINE",
      product: {
        productId: product.productId,
        name: product.name,
        image: product.image,
        manufacturer: product.manufacturer,
        shipped: product.shipped,
        verifiedByRetailer: product.verifiedByRetailer,
        sold: product.sold
      }
    });

  } catch (err) {
    console.error("ðŸ”¥ Verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

/* ================= START SERVER ================= */

app.listen(5000, () => {
  console.log("âœ… Backend running on http://localhost:5000");
});

