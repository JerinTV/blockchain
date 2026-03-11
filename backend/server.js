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

const resolveContractAbi = () => {
  const candidates = [
    path.join(__dirname, "..", "artifacts", "contracts", "TrustChain.sol", "TrustChain.json"),
    path.join(__dirname, "..", "src", "TrustChainAbi.json"),
    path.join(__dirname, "abi.json")
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed.abi)) return parsed.abi;
    } catch (err) {
      console.warn("⚠️ Failed to parse ABI candidate:", candidate, err.message);
    }
  }

  throw new Error("Unable to load contract ABI from known paths");
};

const abi = resolveContractAbi();
const registerBatchInterface = new ethers.Interface([
  "function registerBatchProducts(string batchNumber,string boxId,(string productId,string boxId,string name,string category,string manufacturer,string manufacturerDate,string manufacturePlace,string modelNumber,string serialNumber,string warrantyPeriod,string batchNumber,string color,string specs,uint256 price,string image)[] items)"
]);

/* ================= APP SETUP ================= */

const PORT = Number.parseInt(process.env.PORT || "5000", 10);
const ALLOWED_ORIGINS = String(
  process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    }
  })
);
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.use("/api/auth", authRoutes);

function requireAdmin(req, res, next) {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: `${role} access required` });
    }
    next();
  };
}

function getScopedManufacturerId(req, res) {
  const isAdmin = req.user.role === "ADMIN";

  if (!isAdmin) return req.user.userId;

  if (!req.query.manufacturerId) return req.user.userId;

  const parsed = Number.parseInt(String(req.query.manufacturerId), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    res.status(400).json({ error: "manufacturerId must be a valid integer" });
    return null;
  }

  return parsed;
}

async function getMutationManufacturerIdResolved(req, res) {
  if (req.user.role === "MANUFACTURER") return req.user.userId;

  const raw = req.body?.manufacturerId ?? req.query.manufacturerId;
  const parsed = Number.parseInt(String(raw || ""), 10);
  if (!Number.isNaN(parsed) && parsed > 0) return parsed;

  if (req.user.role === "ADMIN") {
    res.status(400).json({ error: "manufacturerId is required for admin actions" });
    return null;
  }

  const boxId = String(req.params?.boxId || "").trim();
  if (boxId) {
    const matches = await prisma.box.findMany({
      where: { boxId },
      select: { manufacturerId: true },
      distinct: ["manufacturerId"],
      take: 2
    });

    if (matches.length === 1) return matches[0].manufacturerId;
    if (matches.length > 1) {
      res.status(409).json({ error: "Multiple manufacturers found for this boxId; provide manufacturerId" });
      return null;
    }
  }

  const productId = String(req.params?.productId || "").trim();
  if (productId) {
    const matches = await prisma.product.findMany({
      where: { productId },
      select: { manufacturerId: true },
      distinct: ["manufacturerId"],
      take: 2
    });

    if (matches.length === 1) return matches[0].manufacturerId;
    if (matches.length > 1) {
      res.status(409).json({ error: "Multiple manufacturers found for this productId; provide manufacturerId" });
      return null;
    }
  }

  res.status(404).json({ error: "Manufacturer mapping not found for this request" });
  return null;
}

async function normalizeLifecycle(whereBase) {
  await prisma.product.updateMany({
    where: { ...whereBase, sold: true },
    data: { lifecycle: "SOLD" }
  });
  await prisma.product.updateMany({
    where: { ...whereBase, sold: false, verified: true },
    data: { lifecycle: "VERIFIED" }
  });
  await prisma.product.updateMany({
    where: { ...whereBase, sold: false, verified: false, shipped: true },
    data: { lifecycle: "SHIPPED" }
  });
  await prisma.product.updateMany({
    where: { ...whereBase, sold: false, verified: false, shipped: false },
    data: { lifecycle: "CREATED" }
  });
}

app.get("/api/db/box/:boxId/products", authenticate, async (req, res) => {
  try {
    const manufacturerId = getScopedManufacturerId(req, res);
    if (!manufacturerId) return;

    const boxId = String(req.params.boxId || "").trim();
    if (!boxId) {
      return res.status(400).json({ error: "boxId is required" });
    }

    const buyerEmail = String(req.body?.buyerEmail || req.body?.userEmail || "").trim();
    if (!buyerEmail) {
      return res.status(400).json({ error: "Buyer email is required" });
    }

    const box = await prisma.box.findUnique({
      where: {
        manufacturerId_boxId: {
          manufacturerId,
          boxId
        }
      },
      include: {
        retailer: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        products: {
          select: {
            productId: true,
            batchId: true,
            lifecycle: true,
            shipped: true,
            verified: true,
            sold: true,
            soldToEmail: true,
            soldAt: true,
            createdAt: true
          },
          orderBy: { productId: "asc" }
        }
      }
    });

    if (!box) {
      return res.status(404).json({ error: "Box not found" });
    }

    return res.json({
      box: {
        boxId: box.boxId,
        batchId: box.batchId,
        createdAt: box.createdAt,
        retailer: box.retailer
      },
      products: box.products
    });
  } catch (err) {
    console.error("❌ Box products query failed:", err);
    res.status(500).json({ error: "Box products query failed" });
  }
});

app.get("/api/db/box/:boxId/assignment", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "RETAILER") {
      return res.status(403).json({ error: "Retailer access required" });
    }

    const boxId = String(req.params.boxId || "").trim();
    if (!boxId) {
      return res.status(400).json({ error: "boxId is required" });
    }

    const assigned = await prisma.box.findFirst({
      where: {
        boxId,
        retailerId: req.user.userId
      },
      select: {
        boxId: true,
        retailerEmail: true,
        retailer: {
          select: {
            username: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const any = await prisma.box.findFirst({
      where: {
        boxId
      },
      select: {
        retailerEmail: true,
        retailer: {
          select: {
            username: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    if (!assigned && !any) {
    return res.status(404).json({ error: "Box not found" });
  }

    return res.json({
      boxId,
      assignedToCurrent: Boolean(assigned),
      retailerEmail: any?.retailerEmail || null,
      assignedRetailerName: assigned?.retailer?.username || null,
      latestRetailerName: any?.retailer?.username || null
    });
} catch (err) {
  console.error("âŒ Box assignment check failed:", err);
  res.status(500).json({ error: "Box assignment check failed" });
}
});

app.get("/api/db/retailer/shipments", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "RETAILER") {
      return res.status(403).json({ error: "Retailer access required" });
    }

    const shipments = await prisma.box.findMany({
      where: {
        retailerId: req.user.userId
      },
      include: {
        manufacturer: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        products: {
          select: {
            productId: true,
            lifecycle: true,
            shipped: true,
            verified: true,
            sold: true,
            soldToEmail: true,
            soldAt: true
          },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    const SELL_PRICE_PER_ITEM = 1499;
    const MARGIN_RATE = 0.28;

    const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
    const allSoldEmails = new Set();
    shipments.forEach((box) => {
      box.products.forEach((product) => {
        const normalized = normalizeEmail(product.soldToEmail);
        if (normalized) allSoldEmails.add(normalized);
      });
    });
    const buyerUsers =
      allSoldEmails.size > 0
        ? await prisma.user.findMany({
            where: {
              email: {
                in: Array.from(allSoldEmails)
              }
            },
            select: {
              email: true,
              username: true
            }
          })
        : [];
    const buyerMap = new Map(buyerUsers.map((buyer) => [normalizeEmail(buyer.email), buyer.username]));
    const onChainAvailability = await getOnChainAvailabilityMap(
      shipments.flatMap((box) => box.products.map((product) => product.productId))
    );

    const activeBoxIds = new Set();
    const shipmentPayload = shipments
      .map((box) => {
        const activeProducts = box.products.filter((product) => onChainAvailability.get(product.productId));
        const productCount = activeProducts.length;
        if (productCount > 0) activeBoxIds.add(box.id);
        const shippedCount = activeProducts.filter((p) => p.shipped).length;
        const verifiedCount = activeProducts.filter((p) => p.verified).length;
        const soldCount = activeProducts.filter((p) => p.sold).length;
        const manufacturerLabel = box.manufacturer?.username || box.manufacturer?.email || "Trusted partner";
        const retailerLabel = box.retailer?.username || box.retailer?.email || box.retailerEmail || "Retailer";
        const retailerEmail = box.retailer?.email || box.retailerEmail || null;
        const retailerName = box.retailer?.username || box.retailer?.email || null;

        const estimatedRevenue = soldCount * SELL_PRICE_PER_ITEM;
        const estimatedProfit = Math.round(estimatedRevenue * MARGIN_RATE);

        return {
          boxId: box.boxId,
          batchId: box.batchId,
          createdAt: box.createdAt,
          shippingAddress: box.shippingAddress || "",
          manufacturer: {
            id: box.manufacturer?.id || null,
            label: manufacturerLabel
          },
          retailer: {
            id: box.retailer?.id || null,
            email: retailerEmail,
            name: retailerName,
            label: retailerLabel
          },
          productCount,
          shippedCount,
          verifiedCount,
          soldCount,
          productDetails: activeProducts.map((product) => ({
            productId: product.productId,
            lifecycle: product.lifecycle,
            shipped: product.shipped,
            verified: product.verified,
            sold: product.sold,
            soldToEmail: product.soldToEmail,
            soldAt: product.soldAt,
            buyerName: (() => {
              const key = normalizeEmail(product.soldToEmail);
              return key ? buyerMap.get(key) || null : null;
            })(),
            batchId: product.batchId,
            boxId: box.boxId
          })),
          topProducts: activeProducts.slice(0, 5).map((product) => ({
            productId: product.productId,
            lifecycle: product.lifecycle,
            soldToEmail: product.soldToEmail,
            soldAt: product.soldAt
          })),
          estimatedRevenue,
          estimatedProfit
        };
      })
      .filter((box) => box.productCount > 0);

    const summary = shipmentPayload.reduce(
      (acc, item) => {
        acc.totalBoxes += 1;
        acc.totalProducts += item.productCount;
        acc.totalShipped += item.shippedCount;
        acc.totalVerified += item.verifiedCount;
        acc.totalSold += item.soldCount;
        acc.estimatedRevenue += item.estimatedRevenue;
        acc.estimatedProfit += item.estimatedProfit;
        acc.manufacturerCount[item.manufacturer.label] = (acc.manufacturerCount[item.manufacturer.label] || 0) + 1;
        return acc;
      },
      {
        totalBoxes: 0,
        totalProducts: 0,
        totalShipped: 0,
        totalVerified: 0,
        totalSold: 0,
        estimatedRevenue: 0,
        estimatedProfit: 0,
        manufacturerCount: {}
      }
    );

    const topManufacturerEntry = Object.entries(summary.manufacturerCount).sort((a, b) => b[1] - a[1])[0] || [];
    const topManufacturer = topManufacturerEntry[0] || null;

    const summaryPayload = {
      totalBoxes: summary.totalBoxes,
      totalProducts: summary.totalProducts,
      totalShipped: summary.totalShipped,
      totalVerified: summary.totalVerified,
      totalSold: summary.totalSold,
      estimatedRevenue: summary.estimatedRevenue,
      estimatedProfit: summary.estimatedProfit,
      topManufacturer,
      mostRecentBatch: shipmentPayload[0]?.batchId || null
    };

    return res.json({
      summary: summaryPayload,
      shipments: shipmentPayload
    });
  } catch (err) {
    console.error("❌ Retailer shipment feed failed:", err);
    res.status(500).json({ error: "Retailer shipment feed failed" });
  }
});

app.get("/api/db/resolve/box/:boxId", authenticate, async (req, res) => {
  try {
    const boxId = String(req.params.boxId || "").trim();
    if (!boxId) {
      return res.status(400).json({ error: "boxId is required" });
    }

    const matches = await prisma.box.findMany({
      where: { boxId },
      select: { manufacturerId: true },
      distinct: ["manufacturerId"],
      take: 20
    });

    if (matches.length === 0) {
      return res.status(404).json({ error: "Box not found" });
    }
    if (matches.length > 1) {
      return res.status(409).json({
        error: "Multiple manufacturers found for this boxId; provide manufacturerId",
        manufacturerIds: matches.map((m) => m.manufacturerId)
      });
    }

    return res.json({ manufacturerId: matches[0].manufacturerId });
  } catch (err) {
    console.error("❌ Box manufacturer resolve failed:", err);
    res.status(500).json({ error: "Box manufacturer resolve failed" });
  }
});

app.get("/api/db/resolve/product/:productId", authenticate, async (req, res) => {
  try {
    const productId = String(req.params.productId || "").trim();
    if (!productId) {
      return res.status(400).json({ error: "productId is required" });
    }

    const matches = await prisma.product.findMany({
      where: { productId },
      select: { manufacturerId: true },
      distinct: ["manufacturerId"],
      take: 20
    });

    if (matches.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (matches.length > 1) {
      return res.status(409).json({
        error: "Multiple manufacturers found for this productId; provide manufacturerId",
        manufacturerIds: matches.map((m) => m.manufacturerId)
      });
    }

    return res.json({ manufacturerId: matches[0].manufacturerId });
  } catch (err) {
    console.error("❌ Product manufacturer resolve failed:", err);
    res.status(500).json({ error: "Product manufacturer resolve failed" });
  }
});

app.get("/api/db/product/:productId/detail", authenticate, async (req, res) => {
  try {
    const productId = String(req.params.productId || "").trim();
    if (!productId) {
      return res.status(400).json({ error: "productId is required" });
    }

    const manufacturerId = await getMutationManufacturerIdResolved(req, res);
    if (!manufacturerId) return;

    const product = await prisma.product.findFirst({
      where: { manufacturerId, productId },
      include: {
        box: {
          select: {
            boxId: true,
            batchId: true,
            shippingAddress: true,
            retailerEmail: true,
            retailer: {
              select: {
                id: true,
                username: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json({
      product: {
        productId: product.productId,
        lifecycle: product.lifecycle,
        shipped: product.shipped,
        verified: product.verified,
        sold: product.sold,
        soldToEmail: product.soldToEmail,
        soldAt: product.soldAt,
        box: product.box
      }
    });
  } catch (err) {
    console.error("❌ Product detail failed:", err);
    res.status(500).json({ error: "Product detail fetch failed" });
  }
});

app.get("/api/db/user/purchases", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "USER") {
      return res.status(403).json({ error: "User access required" });
    }

    const userEmail = String(req.user.email || "").trim();
    if (!userEmail) {
      return res.status(400).json({ error: "User email missing" });
    }

    const purchases = await prisma.product.findMany({
      where: {
        soldToEmail: userEmail,
        sold: true
      },
      include: {
        box: {
          select: {
            boxId: true,
            batchId: true,
            shippingAddress: true,
            manufacturer: {
              select: {
                username: true,
                email: true
              }
            },
            retailer: {
              select: {
                username: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { soldAt: "desc" },
      take: 20
    });
    const onChainAvailability = await getOnChainAvailabilityMap(
      purchases.map((product) => product.productId)
    );

    const payload = purchases
      .filter((product) => onChainAvailability.get(product.productId))
      .map((product) => ({
      productId: product.productId,
      soldAt: product.soldAt,
      retailerEmail: product.box?.retailer?.email || product.box?.retailerEmail || null,
      retailerName: product.box?.retailer?.username || null,
      manufacturerEmail: product.box?.manufacturer?.email || null,
      manufacturerName: product.box?.manufacturer?.username || null,
      boxId: product.box?.boxId || null,
      batchId: product.box?.batchId || null,
      shippingAddress: product.box?.shippingAddress || null
      }));

    return res.json({ purchases: payload });
  } catch (err) {
    console.error("❌ User purchases failed:", err);
    res.status(500).json({ error: "User purchases fetch failed" });
  }
});

app.get("/api/admin/manufacturers", authenticate, requireAdmin, async (req, res) => {
  try {
    const manufacturers = await prisma.user.findMany({
      where: { role: "MANUFACTURER" },
      select: { id: true, email: true, createdAt: true },
      orderBy: { createdAt: "desc" }
    });

    if (manufacturers.length === 0) {
      return res.json({ manufacturers: [] });
    }

    const [products, boxes] = await Promise.all([
      prisma.product.findMany({
        select: {
          manufacturerId: true,
          productId: true,
          boxId: true,
          createdAt: true,
          shipped: true,
          verified: true,
          sold: true
        }
      }),
      prisma.box.findMany({
        select: {
          id: true,
          manufacturerId: true
        }
      })
    ]);
    const onChainAvailability = await getOnChainAvailabilityMap(
      products.map((product) => product.productId)
    );
    const activeProducts = products.filter((product) => onChainAvailability.get(product.productId));
    const manufacturerMetrics = new Map();

    activeProducts.forEach((product) => {
      const current = manufacturerMetrics.get(product.manufacturerId) || {
        totalProducts: 0,
        shippedProducts: 0,
        verifiedProducts: 0,
        soldProducts: 0,
        latestProductAt: null,
        boxIds: new Set()
      };

      current.totalProducts += 1;
      if (product.shipped) current.shippedProducts += 1;
      if (product.verified) current.verifiedProducts += 1;
      if (product.sold) current.soldProducts += 1;
      if (!current.latestProductAt || new Date(product.createdAt) > new Date(current.latestProductAt)) {
        current.latestProductAt = product.createdAt;
      }
      if (product.boxId) current.boxIds.add(product.boxId);

      manufacturerMetrics.set(product.manufacturerId, current);
    });

    const activeBoxIds = new Set(activeProducts.map((product) => product.boxId).filter(Boolean));
    boxes.forEach((box) => {
      if (!activeBoxIds.has(box.id)) return;
      const current = manufacturerMetrics.get(box.manufacturerId) || {
        totalProducts: 0,
        shippedProducts: 0,
        verifiedProducts: 0,
        soldProducts: 0,
        latestProductAt: null,
        boxIds: new Set()
      };
      current.boxIds.add(box.id);
      manufacturerMetrics.set(box.manufacturerId, current);
    });

    const payload = manufacturers
      .map((m) => {
        const metrics = manufacturerMetrics.get(m.id);
        return {
          id: m.id,
          email: m.email,
          createdAt: m.createdAt,
          totalBoxes: metrics ? metrics.boxIds.size : 0,
          totalProducts: metrics?.totalProducts || 0,
          shippedProducts: metrics?.shippedProducts || 0,
          verifiedProducts: metrics?.verifiedProducts || 0,
          soldProducts: metrics?.soldProducts || 0,
          latestProductAt: metrics?.latestProductAt || null
        };
      })
      .filter((manufacturer) => manufacturer.totalProducts > 0);

    return res.json({ manufacturers: payload });
  } catch (err) {
    console.error("❌ Admin manufacturers query failed:", err);
    res.status(500).json({ error: "Admin manufacturers query failed" });
  }
});

app.get("/api/admin/batches", authenticate, requireAdmin, async (req, res) => {
  try {
    const rawManufacturerId = String(req.query.manufacturerId || "").trim();
    const manufacturerId = rawManufacturerId ? Number.parseInt(rawManufacturerId, 10) : null;

    if (rawManufacturerId && (Number.isNaN(manufacturerId) || manufacturerId <= 0)) {
      return res.status(400).json({ error: "manufacturerId must be a valid integer" });
    }

    const products = await prisma.product.findMany({
      where: manufacturerId ? { manufacturerId } : undefined,
      select: {
        manufacturerId: true,
        batchId: true,
        productId: true,
        createdAt: true
      },
      orderBy: [{ createdAt: "desc" }]
    });
    const onChainAvailability = await getOnChainAvailabilityMap(
      products.map((product) => product.productId)
    );
    const activeProducts = products.filter((product) => onChainAvailability.get(product.productId));
    const batchMap = new Map();

    activeProducts.forEach((product) => {
      const key = `${product.manufacturerId}::${product.batchId}`;
      const current = batchMap.get(key) || {
        manufacturerId: product.manufacturerId,
        batchId: product.batchId,
        productCount: 0,
        latestProductAt: null
      };
      current.productCount += 1;
      if (!current.latestProductAt || new Date(product.createdAt) > new Date(current.latestProductAt)) {
        current.latestProductAt = product.createdAt;
      }
      batchMap.set(key, current);
    });

    return res.json({
      batches: Array.from(batchMap.values()).sort(
        (a, b) => new Date(b.latestProductAt || 0) - new Date(a.latestProductAt || 0)
      )
    });
  } catch (err) {
    console.error("❌ Admin batches query failed:", err);
    res.status(500).json({ error: "Admin batches query failed" });
  }
});

app.get("/api/admin/boxes", authenticate, requireAdmin, async (req, res) => {
  try {
    const rawManufacturerId = String(req.query.manufacturerId || "").trim();
    const batchId = String(req.query.batchId || "").trim();
    const manufacturerId = rawManufacturerId ? Number.parseInt(rawManufacturerId, 10) : null;

    if (rawManufacturerId && (Number.isNaN(manufacturerId) || manufacturerId <= 0)) {
      return res.status(400).json({ error: "manufacturerId must be a valid integer" });
    }

    const [boxes, products] = await Promise.all([
      prisma.box.findMany({
      where: {
        ...(manufacturerId ? { manufacturerId } : {}),
        ...(batchId ? { batchId } : {})
      },
      select: {
        id: true,
        manufacturerId: true,
        boxId: true,
        batchId: true
      },
      orderBy: [
        { createdAt: "desc" }
      ]
      }),
      prisma.product.findMany({
        where: {
          ...(manufacturerId ? { manufacturerId } : {}),
          ...(batchId ? { batchId } : {})
        },
        select: {
          productId: true,
          boxId: true
        }
      })
    ]);
    const onChainAvailability = await getOnChainAvailabilityMap(
      products.map((product) => product.productId)
    );
    const activeCountsByBoxId = new Map();
    products.forEach((product) => {
      if (!onChainAvailability.get(product.productId) || !product.boxId) return;
      activeCountsByBoxId.set(product.boxId, (activeCountsByBoxId.get(product.boxId) || 0) + 1);
    });

    return res.json({
      boxes: boxes
        .map((b) => ({
        manufacturerId: b.manufacturerId,
        boxId: b.boxId,
        batchId: b.batchId,
        productCount: activeCountsByBoxId.get(b.id) || 0
      }))
        .filter((box) => box.productCount > 0)
    });
  } catch (err) {
    console.error("❌ Admin boxes query failed:", err);
    res.status(500).json({ error: "Admin boxes query failed" });
  }
});

app.get("/api/admin/products", authenticate, requireAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || "ALL").trim().toUpperCase();
    const batchId = String(req.query.batchId || "").trim();
    const boxId = String(req.query.boxId || "").trim();
    const fromDate = String(req.query.fromDate || "").trim();
    const toDate = String(req.query.toDate || "").trim();
    const rawManufacturerId = String(req.query.manufacturerId || "").trim();
    const sortBy = String(req.query.sortBy || "createdAt").trim();
    const sortOrder = String(req.query.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const page = Math.max(Number.parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(String(req.query.pageSize || "25"), 10) || 25, 1), 100);

    const manufacturerId = rawManufacturerId ? Number.parseInt(rawManufacturerId, 10) : null;
    if (rawManufacturerId && (Number.isNaN(manufacturerId) || manufacturerId <= 0)) {
      return res.status(400).json({ error: "manufacturerId must be a valid integer" });
    }

    const createdAt = {};
    if (fromDate) createdAt.gte = new Date(`${fromDate}T00:00:00.000Z`);
    if (toDate) createdAt.lte = new Date(`${toDate}T23:59:59.999Z`);

    const where = {
      ...(manufacturerId ? { manufacturerId } : {}),
      ...(batchId ? { batchId } : {}),
      ...(boxId ? { box: { boxId: { contains: boxId, mode: "insensitive" } } } : {}),
      ...(fromDate || toDate ? { createdAt } : {}),
      ...(status !== "ALL" ? { lifecycle: status } : {})
    };

    const orderByMap = {
      createdAt: { createdAt: sortOrder },
      batchId: { batchId: sortOrder },
      productId: { productId: sortOrder },
      lifecycle: { lifecycle: sortOrder },
      manufacturer: { manufacturer: { email: sortOrder } },
      boxId: { box: { boxId: sortOrder } }
    };
    const orderBy = orderByMap[sortBy] || orderByMap.createdAt;

    const products = await prisma.product.findMany({
      where,
      include: {
        manufacturer: {
          select: {
            id: true,
            email: true
          }
        },
        box: {
          select: {
            id: true,
            boxId: true,
            shippingAddress: true
          }
        }
      },
      orderBy
    });
    const onChainAvailability = await getOnChainAvailabilityMap(
      products.map((product) => product.productId)
    );

    const productsWithDerivedLifecycle = products
      .filter((product) => onChainAvailability.get(product.productId))
      .map((p) => {
      let lifecycle = "CREATED";
      if (p.sold) lifecycle = "SOLD";
      else if (p.verified) lifecycle = "VERIFIED";
      else if (p.shipped) lifecycle = "SHIPPED";

      return {
        ...p,
        lifecycle
      };
      });
    const total = productsWithDerivedLifecycle.length;
    const pagedProducts = productsWithDerivedLifecycle.slice((page - 1) * pageSize, page * pageSize);

    return res.json({
      page,
      pageSize,
      total,
      products: pagedProducts
    });
  } catch (err) {
    console.error("❌ Admin products query failed:", err);
    res.status(500).json({ error: "Admin products query failed" });
  }
});

app.get("/api/db/dashboard/summary", authenticate, async (req, res) => {
  try {
    const manufacturerId = getScopedManufacturerId(req, res);
    if (!manufacturerId) return;

    const batchId = String(req.query.batchId || "").trim();

    const productWhere = {
      manufacturerId,
      ...(batchId ? { batchId } : {})
    };

    const boxWhere = {
      manufacturerId,
      ...(batchId ? { batchId } : {})
    };

    const [products, recentBoxesRaw] = await Promise.all([
      prisma.product.findMany({
        where: productWhere,
        select: {
          productId: true,
          boxId: true,
          shipped: true,
          verified: true,
          sold: true
        }
      }),
      prisma.box.findMany({
        where: boxWhere,
        select: {
          id: true,
          boxId: true,
          batchId: true,
          createdAt: true,
          shippingAddress: true,
          retailerEmail: true,
          retailer: {
            select: {
              id: true,
              username: true,
              email: true
            }
          },
          _count: {
            select: { products: true }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 10
      })
    ]);
    const onChainAvailability = await getOnChainAvailabilityMap(
      products.map((product) => product.productId)
    );
    const activeProducts = products.filter((product) => onChainAvailability.get(product.productId));
    const activeBoxIds = new Set(activeProducts.map((product) => product.boxId));
    const recentBoxes = recentBoxesRaw
      .filter((box) => activeBoxIds.has(box.id))
      .map((box) => ({
        ...box,
        _count: {
          products: activeProducts.filter((product) => product.boxId === box.id).length
        }
      }));
    const totalProducts = activeProducts.length;
    const shippedProducts = activeProducts.filter((product) => product.shipped).length;
    const verifiedProducts = activeProducts.filter((product) => product.verified).length;
    const soldProducts = activeProducts.filter((product) => product.sold).length;
    const totalBoxes = activeBoxIds.size;

    return res.json({
      manufacturerId,
      batchId: batchId || null,
      summary: {
        totalBoxes,
        totalProducts,
        shippedProducts,
        verifiedProducts,
        soldProducts,
        pendingProducts: totalProducts - soldProducts
      },
      recentBoxes
    });
  } catch (err) {
    console.error("❌ Dashboard summary query failed:", err);
    res.status(500).json({ error: "Dashboard summary query failed" });
  }
});

app.post("/api/db/box/:boxId/ship", authenticate, async (req, res) => {
  try {
    const manufacturerId = await getMutationManufacturerIdResolved(req, res);
    if (!manufacturerId) return;
    const boxId = String(req.params.boxId || "").trim();
    const shippingAddress = String(req.body?.shippingAddress || "").trim();
    const retailerEmail = String(req.body?.retailerEmail || "").trim();
    let retailer = null;

    if (req.user.role === "MANUFACTURER" && !retailerEmail) {
      return res.status(400).json({ error: "Retailer email is required when shipping a box" });
    }

    if (retailerEmail) {
      retailer = await prisma.user.findUnique({
        where: { email: retailerEmail }
      });
      if (!retailer || retailer.role !== "RETAILER") {
        return res.status(400).json({ error: "Retailer account not found for the provided email" });
      }
    }

    if (!boxId) {
      return res.status(400).json({ error: "boxId is required" });
    }

    const box = await prisma.box.findUnique({
      where: {
        manufacturerId_boxId: {
          manufacturerId,
          boxId
        }
      },
      select: {
        id: true,
        retailerId: true,
        retailerEmail: true
      }
    });

    if (!box) {
      return res.status(404).json({ error: "Box not found" });
    }

    if (box.retailerEmail && retailerEmail && box.retailerEmail.toLowerCase() !== retailerEmail.toLowerCase()) {
      return res.status(403).json({ error: `Box ${boxId} is assigned to ${box.retailerEmail}` });
    }

    const updatePayload = {};
    if (shippingAddress) updatePayload.shippingAddress = shippingAddress;
    if (retailer) {
      updatePayload.retailerId = retailer.id;
      updatePayload.retailerEmail = retailer.email;
    } else if (retailerEmail && req.user.role !== "MANUFACTURER") {
      updatePayload.retailerEmail = retailerEmail;
    }

    if (Object.keys(updatePayload).length > 0) {
      await prisma.box.update({
        where: {
          manufacturerId_boxId: {
            manufacturerId,
            boxId
          }
        },
        data: updatePayload
      });
    }

    await prisma.product.updateMany({
      where: {
        manufacturerId,
        boxId: box.id,
        shipped: false
      },
      data: {
        shipped: true
      }
    });

    await normalizeLifecycle({ manufacturerId, boxId: box.id });

    const shippedCount = await prisma.product.count({
      where: {
        manufacturerId,
        boxId: box.id,
        shipped: true
      }
    });

    return res.json({
      boxId,
      shippedCount
    });
  } catch (err) {
    console.error("❌ Box ship sync failed:", err);
    res.status(500).json({ error: "Box ship sync failed" });
  }
});

app.post("/api/db/box/:boxId/verify", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "RETAILER") {
      return res.status(403).json({ error: "Retailer access required" });
    }
    const manufacturerId = await getMutationManufacturerIdResolved(req, res);
    if (!manufacturerId) return;

    const boxId = String(req.params.boxId || "").trim();
    if (!boxId) {
      return res.status(400).json({ error: "boxId is required" });
    }

    const box = await prisma.box.findUnique({
      where: {
        manufacturerId_boxId: {
          manufacturerId,
          boxId
        }
      },
      select: {
        id: true,
        retailerId: true,
        retailerEmail: true
      }
    });

    if (!box) {
      return res.status(404).json({ error: "Box not found" });
    }
    if (!box.retailerId || box.retailerId !== req.user.userId) {
      const assignedTo = box.retailerEmail ? box.retailerEmail : "another retailer";
      return res.status(403).json({ error: `Box ${boxId} is assigned to ${assignedTo}` });
    }

    await prisma.product.updateMany({
      where: {
        manufacturerId,
        boxId: box.id,
        sold: false
      },
      data: {
        verified: true
      }
    });

    await normalizeLifecycle({ manufacturerId, boxId: box.id });

    const verifiedCount = await prisma.product.count({
      where: {
        manufacturerId,
        boxId: box.id,
        verified: true
      }
    });

    return res.json({ boxId, verifiedCount });
  } catch (err) {
    console.error("❌ Box verify sync failed:", err);
    res.status(500).json({ error: "Box verify sync failed" });
  }
});

app.post("/api/db/box/:boxId/sold", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "RETAILER") {
      return res.status(403).json({ error: "Retailer access required" });
    }
    const manufacturerId = await getMutationManufacturerIdResolved(req, res);
    if (!manufacturerId) return;

    const boxId = String(req.params.boxId || "").trim();
    if (!boxId) {
      return res.status(400).json({ error: "boxId is required" });
    }

    const box = await prisma.box.findUnique({
      where: {
        manufacturerId_boxId: {
          manufacturerId,
          boxId
        }
      }
    });

    if (!box) {
      return res.status(404).json({ error: "Box not found" });
    }

    await prisma.product.updateMany({
      where: {
        manufacturerId,
        boxId: box.id
      },
      data: {
        sold: true,
        verified: true,
        shipped: true,
        soldToEmail: buyerEmail,
        soldAt: new Date()
      }
    });

    await normalizeLifecycle({ manufacturerId, boxId: box.id });

    const soldCount = await prisma.product.count({
      where: {
        manufacturerId,
        boxId: box.id,
        sold: true
      }
    });

    return res.json({ boxId, soldCount });
  } catch (err) {
    console.error("❌ Box sold sync failed:", err);
    res.status(500).json({ error: "Box sold sync failed" });
  }
});

app.post("/api/db/product/:productId/verify", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "RETAILER") {
      return res.status(403).json({ error: "Retailer access required" });
    }
    const manufacturerId = await getMutationManufacturerIdResolved(req, res);
    if (!manufacturerId) return;

    const productId = String(req.params.productId || "").trim();
    if (!productId) {
      return res.status(400).json({ error: "productId is required" });
    }

    const product = await prisma.product.findFirst({
      where: { manufacturerId, productId },
      include: {
        box: {
          select: {
            id: true,
            retailerId: true,
            retailerEmail: true
          }
        }
      }
    });

    if (!product || !product.box) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (!product.box.retailerId || product.box.retailerId !== req.user.userId) {
      const assignedTo = product.box.retailerEmail ? product.box.retailerEmail : "another retailer";
      return res.status(403).json({ error: `Product is assigned to ${assignedTo}` });
    }

    const updated = await prisma.product.updateMany({
      where: {
        manufacturerId,
        productId,
        sold: false
      },
      data: {
        verified: true
      }
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    await normalizeLifecycle({ manufacturerId, productId });

    return res.json({ productId, updated: true });
  } catch (err) {
    console.error("❌ Product verify sync failed:", err);
    res.status(500).json({ error: "Product verify sync failed" });
  }
});

app.post("/api/db/product/:productId/sold", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "RETAILER") {
      return res.status(403).json({ error: "Retailer access required" });
    }
    const manufacturerId = await getMutationManufacturerIdResolved(req, res);
    if (!manufacturerId) return;

    const productId = String(req.params.productId || "").trim();
    if (!productId) {
      return res.status(400).json({ error: "productId is required" });
    }

    const buyerEmail = String(req.body?.buyerEmail || req.body?.userEmail || "").trim();
    if (!buyerEmail) {
      return res.status(400).json({ error: "Buyer email is required" });
    }

    const product = await prisma.product.findFirst({
      where: { manufacturerId, productId },
      include: {
        box: {
          select: {
            id: true,
            retailerId: true,
            retailerEmail: true
          }
        }
      }
    });

    if (!product || !product.box) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (!product.box.retailerId || product.box.retailerId !== req.user.userId) {
      const assignedTo = product.box.retailerEmail ? product.box.retailerEmail : "another retailer";
      return res.status(403).json({ error: `Product is assigned to ${assignedTo}` });
    }

    const updated = await prisma.product.updateMany({
      where: {
        manufacturerId,
        productId
      },
      data: {
        sold: true,
        verified: true,
        shipped: true,
        soldToEmail: buyerEmail,
        soldAt: new Date()
      }
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    await normalizeLifecycle({ manufacturerId, productId });

    return res.json({ productId, updated: true });
  } catch (err) {
    console.error("❌ Product sold sync failed:", err);
    res.status(500).json({ error: "Product sold sync failed" });
  }
});
/* ================= BLOCKCHAIN SETUP ================= */

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  abi,
  wallet
);

async function getOnChainAvailabilityMap(productIds) {
  const uniqueIds = Array.from(
    new Set(
      (Array.isArray(productIds) ? productIds : [])
        .map((productId) => String(productId || "").trim())
        .filter(Boolean)
    )
  );

  const availabilityEntries = await Promise.all(
    uniqueIds.map(async (productId) => {
      try {
        const product = await contract.getProduct(productId);
        const exists = Boolean(String(product?.productId || "").trim());
        return [productId, exists];
      } catch {
        return [productId, false];
      }
    })
  );

  return new Map(availabilityEntries);
}

/* ================= CHALLENGE STORE ================= */

const activeChallenges = new Map();

/* ================= UTILS ================= */

function generateChallenge() {
  return crypto.randomBytes(8).toString("hex");
}

const DRAFT_TTL_MS = 15 * 60 * 1000;
const DRAFT_SECRET = process.env.JWT_SECRET || process.env.PRIVATE_KEY || "draft-secret";

function encodeBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signDraft(payloadObj) {
  const payload = encodeBase64Url(JSON.stringify(payloadObj));
  const signature = crypto.createHmac("sha256", DRAFT_SECRET).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function verifyDraft(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = crypto.createHmac("sha256", DRAFT_SECRET).update(payload).digest("hex");

  if (signature !== expected) return null;

  try {
    return JSON.parse(decodeBase64Url(payload));
  } catch {
    return null;
  }
}

/* =====================================================
   0️⃣ STORE NFC SECRET (manufacturing time)
   ===================================================== */



/* =====================================================
   1️⃣ CHALLENGE ENDPOINT
   ===================================================== */

app.post("/challenge", async (req, res) => {
  try {
    const { productId } = req.body;

    console.log("🔍 /challenge request:", productId);

    if (!productId) {
      return res.status(400).json({ error: "productId required" });
    }

    let product;
    try {
      product = await contract.getProduct(productId);
    } catch (bcErr) {
      console.error("❌ Blockchain error:", bcErr);
      return res.status(500).json({ error: "Blockchain read failed" });
    }

    // 🔐 SAFETY CHECK
    if (!product || !product.productId || product.productId.length === 0) {
      return res.json({ status: "FAKE", reason: "Not registered" });
    }

    if (!product.shipped || !product.verifiedByRetailer) {
      return res.json({ status: "NOT_READY" });
    }

    const challenge = generateChallenge();
    activeChallenges.set(productId, challenge);

    console.log("✅ Challenge issued:", challenge);
    res.json({ challenge });

  } catch (err) {
    console.error("🔥 Challenge error:", err);
    res.status(500).json({ error: "Challenge generation failed" });
  }
});

app.post("/nfc/sign", async (req, res) => {
  try {
    const { productId, challenge } = req.body;

    console.log("📡 /nfc/sign called");
    console.log("Body:", req.body);

    if (!productId || !challenge) {
      return res.status(400).json({
        error: "productId & challenge required"
      });
    }

    const response = await signChallenge(productId, challenge,);

    res.json({ response });

  } catch (err) {
    console.error("❌ NFC SIGN ERROR:", err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post("/prepare-batch", authenticate, async (req, res) => {
  try {
    const batch = req.body;
    const manufacturerId = req.user.userId;
    if (req.user.role !== "MANUFACTURER") {
      return res.status(403).json({ error: "Manufacturer access required" });
    }

    const batchId = String(batch.batchId || "").trim();
    const boxId = String(batch.boxId || "").trim();
    const batchSize = Number.parseInt(String(batch.batchSize || "0"), 10);
    const startRaw = String(batch.startProductId || "").trim();
    const startNum = Number.parseInt(startRaw.replace(/\D/g, ""), 10);

    if (!batchId || !boxId || !startRaw || Number.isNaN(startNum) || startNum <= 0 || Number.isNaN(batchSize) || batchSize <= 0) {
      return res.status(400).json({ error: "Invalid batch payload" });
    }

    const existingBox = await prisma.box.findUnique({
      where: {
        manufacturerId_boxId: {
          manufacturerId,
          boxId
        }
      }
    });

    if (existingBox) {
      return res.status(400).json({
        error: `Box ${boxId} already exists`
      });
    }

    const batchSecret = crypto.randomBytes(32).toString("hex");
    const items = [];
    const productRows = [];
    const candidateProductIds = [];

    for (let i = 0; i < batchSize; i++) {
      const productId = `P${startNum + i}`;
      const serialNumber = `${batchId}-SN-${i + 1}`;
      candidateProductIds.push(productId);

      const productSecret = crypto
        .createHash("sha256")
        .update(batchSecret + productId)
        .digest("hex");

      productRows.push({
        productId,
        nfcSecret: productSecret,
        batchId
      });

      items.push({
        productId,
        boxId,
        name: batch.name,
        category: batch.category,
        manufacturer: batch.manufacturer,
        manufacturerDate: batch.manufacturerDate,
        manufacturePlace: batch.manufacturePlace,
        modelNumber: batch.modelNumber,
        serialNumber,
        warrantyPeriod: batch.warrantyPeriod,
        batchNumber: batchId,
        color: batch.color,
        specs: JSON.stringify({ batch: batchId }),
        price: batch.price,
        image: batch.image
      });
    }

    const existingProducts = await prisma.product.findMany({
      where: {
        manufacturerId,
        productId: {
          in: candidateProductIds
        }
      },
      select: {
        productId: true
      }
    });

    if (existingProducts.length > 0) {
      return res.status(400).json({
        error: `Product ${existingProducts[0].productId} already exists`
      });
    }

    const draftPayload = {
      manufacturerId,
      createdAt: Date.now(),
      batch: {
        batchId,
        boxId,
        batchSize,
        startProductId: startRaw
      },
      items,
      productRows
    };
    const draftToken = signDraft(draftPayload);

    return res.json({
      draftToken,
      batchId,
      boxId,
      items
    });

  } catch (err) {
    console.error("❌ Batch preparation failed:", err);
    res.status(500).json({ error: "Batch preparation failed" });
  }
});

app.post("/finalize-batch", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "MANUFACTURER") {
      return res.status(403).json({ error: "Manufacturer access required" });
    }

    const manufacturerId = req.user.userId;
    const draftToken = String(req.body?.draftToken || "").trim();
    const txHash = String(req.body?.txHash || "").trim();

    if (!draftToken || !txHash) {
      return res.status(400).json({ error: "draftToken and txHash are required" });
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return res.status(400).json({ error: "Invalid txHash format" });
    }

    const draft = verifyDraft(draftToken);
    if (!draft) {
      return res.status(400).json({ error: "Invalid draft token" });
    }
    if (draft.manufacturerId !== manufacturerId) {
      return res.status(403).json({ error: "Draft does not belong to this manufacturer" });
    }
    if (!draft.createdAt || (Date.now() - Number(draft.createdAt)) > DRAFT_TTL_MS) {
      return res.status(400).json({ error: "Draft expired. Prepare batch again." });
    }

    const [tx, receipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash)
    ]);

    if (!tx || !receipt) {
      return res.status(400).json({ error: "Transaction not found or not mined yet" });
    }
    if (receipt.status !== 1) {
      return res.status(400).json({ error: "Transaction reverted on-chain" });
    }
    if (!tx.to || tx.to.toLowerCase() !== String(process.env.CONTRACT_ADDRESS).toLowerCase()) {
      return res.status(400).json({ error: "Transaction target contract mismatch" });
    }

    let parsed;
    try {
      parsed = registerBatchInterface.parseTransaction({
        data: tx.data,
        value: tx.value
      });
    } catch {
      const selector = String(tx.data || "").slice(0, 10);
      return res.status(400).json({ error: `Unexpected transaction method selector ${selector}` });
    }

    const [txBatchId, txBoxId, txItems] = parsed.args;
    if (String(txBatchId) !== String(draft.batch.batchId) || String(txBoxId) !== String(draft.batch.boxId)) {
      return res.status(400).json({ error: "Transaction batch details do not match prepared draft" });
    }
    if (!Array.isArray(txItems) || txItems.length !== draft.items.length) {
      return res.status(400).json({ error: "Transaction item count mismatch" });
    }

    for (let i = 0; i < draft.items.length; i++) {
      const expected = draft.items[i];
      const actual = txItems[i];
      if (
        String(actual.productId) !== String(expected.productId) ||
        String(actual.boxId) !== String(expected.boxId) ||
        String(actual.batchNumber) !== String(expected.batchNumber) ||
        String(actual.serialNumber) !== String(expected.serialNumber) ||
        String(actual.price) !== String(expected.price)
      ) {
        return res.status(400).json({ error: "Transaction payload does not match prepared draft" });
      }
    }

    const existingBox = await prisma.box.findUnique({
      where: {
        manufacturerId_boxId: {
          manufacturerId,
          boxId: draft.batch.boxId
        }
      },
      select: {
        id: true
      }
    });

    if (existingBox) {
      const existingCount = await prisma.product.count({
        where: {
          manufacturerId,
          box: {
            boxId: draft.batch.boxId
          },
          productId: {
            in: draft.productRows.map((p) => p.productId)
          }
        }
      });
      if (existingCount === draft.productRows.length) {
        return res.json({ finalized: true, alreadyFinalized: true, txHash });
      }
      return res.status(409).json({ error: "Box already exists with inconsistent data" });
    }

    await prisma.$transaction(async (txClient) => {
      const createdBox = await txClient.box.create({
        data: {
          boxId: draft.batch.boxId,
          batchId: draft.batch.batchId,
          manufacturerId
        }
      });

      await txClient.product.createMany({
        data: draft.productRows.map((row) => ({
          productId: row.productId,
          nfcSecret: row.nfcSecret,
          manufacturerId,
          boxId: createdBox.id,
          batchId: row.batchId
        }))
      });
    });

    return res.json({ finalized: true, txHash });
  } catch (err) {
    console.error("❌ Batch finalization failed:", err);
    res.status(500).json({ error: "Batch finalization failed" });
  }
});





/* =====================================================
   2️⃣ VERIFY ENDPOINT
   ===================================================== */

app.post("/verify", async (req, res) => {
  try {
    const { productId, response } = req.body;

    console.log("🔐 /verify request:", productId);

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
      console.error("❌ NFC error:", nfcErr);
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
    console.error("🔥 Verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

/* ================= START SERVER ================= */

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
