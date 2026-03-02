import React, { useEffect, useMemo, useState } from "react";
import {
  FaArrowDown,
  FaArrowUp,
  FaBullseye,
  FaClipboardCheck,
  FaChartLine,
  FaChartPie,
  FaCheckCircle,
  FaClock,
  FaCube,
  FaDatabase,
  FaDollarSign,
  FaEdit,
  FaEye,
  FaHistory,
  FaIdBadge,
  FaIndustry,
  FaLink,
  FaMapMarkerAlt,
  FaRocket,
  FaSave,
  FaShieldAlt,
  FaShoppingCart,
  FaSyncAlt,
  FaTag,
  FaTrash,
  FaTruck,
  FaUser,
  FaUserShield,
  FaUserTag,
  FaUsers,
  FaBoxes
} from "react-icons/fa";
import BackButton from "../../components/BackButton";
import {
  fetchAdminBlockchainBlocks,
  fetchAdminOverview,
  fetchAdminProducts,
  fetchAdminUsers,
  fetchSalesAnalytics,
  deleteAdminUser,
  updateAdminUser
} from "../../services/adminApi";
import "../../dash.css";

function MiniAreaChart({ points = [] }) {
  const width = 760;
  const height = 320;
  const padding = { top: 18, right: 18, bottom: 42, left: 54 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const rawMax = Math.max(...points.map((p) => Number(p.soldCount || 0)), 1);
  const max = rawMax <= 5 ? 5 : Math.ceil(rawMax / 5) * 5;
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const formatShortDate = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const coords = points.map((p, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + plotHeight - ((Number(p.soldCount || 0) / max) * plotHeight);
    return { x, y, label: p.date, val: Number(p.soldCount || 0) };
  });

  const buildSmoothPath = (list) => {
    if (!list.length) return "";
    if (list.length === 1) return `M ${list[0].x} ${list[0].y}`;
    const path = [`M ${list[0].x} ${list[0].y}`];
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1];
      const curr = list[i];
      const cx = (prev.x + curr.x) / 2;
      path.push(`Q ${cx} ${prev.y} ${curr.x} ${curr.y}`);
    }
    return path.join(" ");
  };

  const linePath = buildSmoothPath(coords);
  const areaPath = coords.length
    ? `${linePath} L ${coords[coords.length - 1].x} ${padding.top + plotHeight} L ${coords[0].x} ${padding.top + plotHeight} Z`
    : "";
  const yTicks = [max, Math.round(max * 0.66), Math.round(max * 0.33), 0];
  const xTickIndexes = (() => {
    if (coords.length <= 5) return coords.map((_, i) => i);
    const last = coords.length - 1;
    const idx = [
      0,
      Math.round(last * 0.25),
      Math.round(last * 0.5),
      Math.round(last * 0.75),
      last
    ];
    return Array.from(new Set(idx));
  })();

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="admin-area-chart" role="img" aria-label="Sales trend with axes">
      <defs>
        <linearGradient id="adminAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="adminLineStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>

      <rect
        x={padding.left}
        y={padding.top}
        width={plotWidth}
        height={plotHeight}
        rx="10"
        fill="rgba(15,23,42,.35)"
        stroke="rgba(96,165,250,.18)"
      />

      {yTicks.map((tick) => {
        const y = padding.top + plotHeight - ((tick / max) * plotHeight);
        return (
          <g key={`y-${tick}`}>
            <line
              x1={padding.left}
              y1={y}
              x2={padding.left + plotWidth}
              y2={y}
              stroke="rgba(148,163,184,.32)"
              strokeDasharray="4 5"
            />
            <text x={padding.left - 10} y={y + 4} textAnchor="end" fill="#cfe1fb" fontSize="12" fontWeight="700">
              {tick}
            </text>
          </g>
        );
      })}

      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + plotHeight} stroke="#93c5fd" strokeWidth="1.3" />
      <line x1={padding.left} y1={padding.top + plotHeight} x2={padding.left + plotWidth} y2={padding.top + plotHeight} stroke="#93c5fd" strokeWidth="1.3" />

      {coords.length > 1 && <path d={areaPath} fill="url(#adminAreaFill)" />}
      {coords.length > 1 && <path d={linePath} fill="none" stroke="url(#adminLineStroke)" strokeWidth="3.2" strokeLinecap="round" />}

      {coords.map((c) => (
        <g key={`${c.label}-${c.val}`}>
          <circle cx={c.x} cy={c.y} r="6.5" fill="rgba(37,99,235,.24)" />
          <circle cx={c.x} cy={c.y} r="3.4" fill="#38bdf8" stroke="#1d4ed8" strokeWidth="1.2" />
        </g>
      ))}

      {xTickIndexes.map((idx) => {
        const c = coords[idx];
        if (!c) return null;
        return (
          <text key={`x-${idx}`} x={c.x} y={padding.top + plotHeight + 20} textAnchor="middle" fill="#cfe1fb" fontSize="12" fontWeight="700">
            {formatShortDate(c.label)}
          </text>
        );
      })}

      <text x={18} y={16} fill="#9ec5f8" fontSize="12" fontWeight="800">Y: Sold Units</text>
      <text x={width / 2} y={height - 8} textAnchor="middle" fill="#9ec5f8" fontSize="12" fontWeight="800">X: Timeline</text>
    </svg>
  );
}

const AdminDashboard = () => {
  const role = String(localStorage.getItem("role") || "").toLowerCase();
  const isAdmin = role === "admin";

  const [section, setSection] = useState("overview");
  const [status, setStatus] = useState("");

  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [analyticsRange, setAnalyticsRange] = useState("week");
  const [analytics, setAnalytics] = useState({ daily: [], byArea: [] });
  const [selectedOverviewKey, setSelectedOverviewKey] = useState("totalBatches");
  const [selectedRoleTable, setSelectedRoleTable] = useState(null);
  const [roleSearchTerm, setRoleSearchTerm] = useState("");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [manufacturerFilter, setManufacturerFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [boxFilter, setBoxFilter] = useState("all");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");

  const [editingUserId, setEditingUserId] = useState(null);
  const [editingUser, setEditingUser] = useState({ email: "", role: "", profileName: "" });
  const [deletingUserId, setDeletingUserId] = useState(null);

  const [viewingProductId, setViewingProductId] = useState("");

  const [chainLoading, setChainLoading] = useState(false);
  const [chainBlocks, setChainBlocks] = useState([]);
  const [chainLastUpdated, setChainLastUpdated] = useState(null);

  const loadAll = async () => {
    setStatus("");
    const [ov, us, ps, an] = await Promise.allSettled([
      fetchAdminOverview(),
      fetchAdminUsers(),
      fetchAdminProducts(250),
      fetchSalesAnalytics(analyticsRange)
    ]);

    const errors = [];
    if (ov.status === "fulfilled") setOverview(ov.value);
    else errors.push(`Overview: ${ov.reason?.message || "failed"}`);

    if (us.status === "fulfilled") setUsers(us.value);
    else errors.push(`Users: ${us.reason?.message || "failed"}`);

    if (ps.status === "fulfilled") setProducts(ps.value);
    else errors.push(`Products: ${ps.reason?.message || "failed"}`);

    if (an.status === "fulfilled") setAnalytics(an.value);
    else errors.push(`Analytics: ${an.reason?.message || "failed"}`);

    if (errors.length) {
      setStatus(`Some data could not load. ${errors.join(" | ")}`);
    }
  };

  const loadBlockchainBlocks = async () => {
    try {
      setChainLoading(true);
      setStatus("");
      const result = await fetchAdminBlockchainBlocks(14);
      setChainBlocks(result?.blocks || []);
      setChainLastUpdated(new Date());
    } catch (err) {
      setStatus(err?.message || "Failed to fetch blockchain blocks");
      setChainBlocks([]);
    } finally {
      setChainLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAll();
    }
  }, [analyticsRange]);

  useEffect(() => {
    if (isAdmin && section === "chain" && chainBlocks.length === 0 && !chainLoading) {
      loadBlockchainBlocks();
    }
  }, [isAdmin, section]);

  const stats = overview?.totals || {
    totalUsers: 0,
    totalBatches: 0,
    totalBoxes: 0,
    totalProducts: 0,
    registeredProducts: 0,
    soldProducts: 0,
    verifiedProducts: 0,
    shippedProducts: 0,
    pendingProducts: 0
  };
  const topArea = useMemo(() => (analytics?.byArea?.length ? analytics.byArea : []), [analytics]);
  const dailySales = useMemo(() => (Array.isArray(analytics?.daily) ? analytics.daily : []), [analytics]);
  const soldProductsCount = useMemo(() => products.filter((p) => p.sold).length, [products]);
  const soldRevenue = useMemo(
    () => products.filter((p) => p.sold).reduce((sum, p) => sum + Number(p.price || 0), 0),
    [products]
  );
  const avgSellingPrice = soldProductsCount > 0 ? Math.round(soldRevenue / soldProductsCount) : 0;
  const sellThroughRate = Number(stats.totalProducts || 0) > 0
    ? (Number(stats.soldProducts || 0) / Number(stats.totalProducts || 1)) * 100
    : 0;
  const shippedToSoldRate = Number(stats.shippedProducts || 0) > 0
    ? (Number(stats.soldProducts || 0) / Number(stats.shippedProducts || 1)) * 100
    : 0;
  const verifiedToSoldRate = Number(stats.verifiedProducts || 0) > 0
    ? (Number(stats.soldProducts || 0) / Number(stats.verifiedProducts || 1)) * 100
    : 0;
  const trendSummary = useMemo(() => {
    const points = dailySales.map((d) => Number(d.soldCount || 0));
    if (points.length === 0) {
      return { growthPct: 0, currentHalf: 0, previousHalf: 0 };
    }
    const splitIndex = Math.max(1, Math.floor(points.length / 2));
    const previousHalf = points.slice(0, splitIndex).reduce((a, b) => a + b, 0);
    const currentHalf = points.slice(splitIndex).reduce((a, b) => a + b, 0);
    const growthPct =
      previousHalf === 0
        ? currentHalf > 0
          ? 100
          : 0
        : ((currentHalf - previousHalf) / previousHalf) * 100;
    return { growthPct, currentHalf, previousHalf };
  }, [dailySales]);
  const totalSalesInRange = useMemo(
    () => dailySales.reduce((sum, d) => sum + Number(d.soldCount || 0), 0),
    [dailySales]
  );
  const areaInsights = useMemo(() => {
    const sorted = [...topArea].sort((a, b) => Number(b.soldCount || 0) - Number(a.soldCount || 0));
    const leader = sorted[0] || null;
    const leaderShare = totalSalesInRange > 0 && leader
      ? (Number(leader.soldCount || 0) / totalSalesInRange) * 100
      : 0;
    return { sorted, leader, leaderShare };
  }, [topArea, totalSalesInRange]);
  const analyticsFunnel = [
    { key: "registered", label: "Registered", value: Number(stats.registeredProducts || stats.totalProducts || 0), icon: FaClipboardCheck },
    { key: "shipped", label: "Shipped", value: Number(stats.shippedProducts || 0), icon: FaTruck },
    { key: "verified", label: "Verified", value: Number(stats.verifiedProducts || 0), icon: FaShieldAlt },
    { key: "sold", label: "Sold", value: Number(stats.soldProducts || 0), icon: FaShoppingCart }
  ];
  const funnelBase = Math.max(analyticsFunnel[0]?.value || 0, 1);
  const growthTone = trendSummary.growthPct >= 0 ? "up" : "down";
  const growthAbs = Math.abs(trendSummary.growthPct).toFixed(1);
  const momentumLabel =
    trendSummary.growthPct >= 18
      ? "Strong acceleration"
      : trendSummary.growthPct >= 5
        ? "Healthy growth"
        : trendSummary.growthPct >= -5
          ? "Stable demand"
          : "Demand cooling";
  const formatMoney = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  const inTransitCount = useMemo(
    () => products.filter((p) => p.shipped && !p.sold).length,
    [products]
  );
  const unsoldCount = useMemo(
    () => Math.max(Number(stats.totalProducts || 0) - Number(stats.soldProducts || 0), 0),
    [stats]
  );
  const roleUsers = useMemo(() => {
    const normalizeRole = (value) => String(value || "").trim().toUpperCase();
    return {
      ADMIN: users.filter((u) => normalizeRole(u.role) === "ADMIN"),
      MANUFACTURER: users.filter((u) => normalizeRole(u.role) === "MANUFACTURER"),
      RETAILER: users.filter((u) => normalizeRole(u.role) === "RETAILER"),
      USER: users.filter((u) => normalizeRole(u.role) === "USER")
    };
  }, [users]);
  const roleTableConfig = [
    { key: "ADMIN", label: "Admin", icon: FaUserShield },
    { key: "MANUFACTURER", label: "Manufacturers", icon: FaIndustry },
    { key: "RETAILER", label: "Retailers", icon: FaUserTag },
    { key: "USER", label: "Users", icon: FaUser }
  ];
  const selectedRoleConfig = roleTableConfig.find((r) => r.key === selectedRoleTable) || null;
  const selectedRoleUsers = useMemo(
    () => (selectedRoleTable ? (roleUsers[selectedRoleTable] || []) : []),
    [selectedRoleTable, roleUsers]
  );
  const filteredRoleUsers = useMemo(() => {
    const query = roleSearchTerm.trim().toLowerCase();
    if (!query) return selectedRoleUsers;
    return selectedRoleUsers.filter((u) => {
      const haystack = [
        u.id,
        u.email,
        u.role,
        u.profileName,
        u.createdAt
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return haystack.includes(query);
    });
  }, [selectedRoleUsers, roleSearchTerm]);
  const filteredProducts = useMemo(() => {
    const query = productSearchTerm.trim().toLowerCase();
    const fromDate = fromDateFilter ? new Date(`${fromDateFilter}T00:00:00`) : null;
    const toDate = toDateFilter ? new Date(`${toDateFilter}T23:59:59.999`) : null;
    const searched = !query
      ? products
      : products.filter((p) => {
          const haystack = [
            p.productId,
            p.name,
            p.category,
            p.modelNumber,
            p.serialNumber,
            p.batchId,
            p.boxId,
            p.manufacturer,
            p.manufacturePlace,
            p.retailerId,
            p.retailerLocation,
            p.price,
            p.shipped ? "shipped" : "not shipped",
            p.verified ? "verified" : "not verified",
            p.sold ? "sold" : "not sold"
          ]
            .map((v) => String(v || "").toLowerCase())
            .join(" ");
          return haystack.includes(query);
        });

    return searched.filter((p) => {
      const productManufacturer = String(p.manufacturer || "").trim() || "Unknown Manufacturer";
      if (manufacturerFilter !== "all" && productManufacturer !== manufacturerFilter) {
        return false;
      }
      if (batchFilter !== "all" && String(p.batchId || "") !== batchFilter) {
        return false;
      }
      if (boxFilter !== "all" && String(p.boxId || "") !== boxFilter) {
        return false;
      }
      const createdAt = p.createdAt ? new Date(p.createdAt) : null;
      if (fromDate && createdAt && createdAt < fromDate) {
        return false;
      }
      if (toDate && createdAt && createdAt > toDate) {
        return false;
      }
      if ((fromDate || toDate) && !createdAt) {
        return false;
      }
      return true;
    });
  }, [products, productSearchTerm, manufacturerFilter, batchFilter, boxFilter, fromDateFilter, toDateFilter]);

  const manufacturerOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((p) => String(p.manufacturer || "").trim() || "Unknown Manufacturer")
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const manufacturerScopedProducts = useMemo(() => {
    const fromDate = fromDateFilter ? new Date(`${fromDateFilter}T00:00:00`) : null;
    const toDate = toDateFilter ? new Date(`${toDateFilter}T23:59:59.999`) : null;
    return products.filter((p) => {
      const productManufacturer = String(p.manufacturer || "").trim() || "Unknown Manufacturer";
      if (manufacturerFilter !== "all" && productManufacturer !== manufacturerFilter) {
        return false;
      }
      const createdAt = p.createdAt ? new Date(p.createdAt) : null;
      if (fromDate && createdAt && createdAt < fromDate) {
        return false;
      }
      if (toDate && createdAt && createdAt > toDate) {
        return false;
      }
      if ((fromDate || toDate) && !createdAt) {
        return false;
      }
      return true;
    });
  }, [products, manufacturerFilter, fromDateFilter, toDateFilter]);

  const batchOptions = useMemo(
    () =>
      Array.from(
        new Set(manufacturerScopedProducts.map((p) => String(p.batchId || "").trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [manufacturerScopedProducts]
  );

  const batchScopedProducts = useMemo(() => {
    if (batchFilter === "all") return manufacturerScopedProducts;
    return manufacturerScopedProducts.filter((p) => String(p.batchId || "") === batchFilter);
  }, [manufacturerScopedProducts, batchFilter]);

  const boxOptions = useMemo(
    () =>
      Array.from(new Set(batchScopedProducts.map((p) => String(p.boxId || "").trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [batchScopedProducts]
  );

  const manufacturerBatchBoxSummary = useMemo(() => {
    const grouped = manufacturerScopedProducts.reduce((acc, p) => {
      const manufacturer = String(p.manufacturer || "").trim() || "Unknown Manufacturer";
      const batchId = String(p.batchId || "").trim() || "NO_BATCH";
      const boxId = String(p.boxId || "").trim() || "NO_BOX";
      const productId = String(p.productId || "").trim() || "-";

      if (!acc[manufacturer]) {
        acc[manufacturer] = {};
      }
      if (!acc[manufacturer][batchId]) {
        acc[manufacturer][batchId] = {};
      }
      if (!acc[manufacturer][batchId][boxId]) {
        acc[manufacturer][batchId][boxId] = [];
      }
      acc[manufacturer][batchId][boxId].push({
        productId,
        registered: Boolean(p.registered)
      });
      return acc;
    }, {});

    const manufacturerKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    return manufacturerKeys.map((manufacturer) => {
      const batches = Object.keys(grouped[manufacturer]).sort((a, b) => a.localeCompare(b));
      return {
        manufacturer,
        batches: batches.map((batchId) => {
          const boxes = Object.keys(grouped[manufacturer][batchId]).sort((a, b) => a.localeCompare(b));
          return {
            batchId,
            boxes: boxes.map((boxId) => {
              const productsInBox = grouped[manufacturer][batchId][boxId];
              return {
                boxId,
                totalProducts: productsInBox.length,
                registeredProducts: productsInBox.filter((x) => x.registered).length,
                productIds: productsInBox.map((x) => x.productId)
              };
            })
          };
        })
      };
    });
  }, [manufacturerScopedProducts]);

  useEffect(() => {
    if (manufacturerFilter !== "all" && !manufacturerOptions.includes(manufacturerFilter)) {
      setManufacturerFilter("all");
    }
  }, [manufacturerFilter, manufacturerOptions]);

  useEffect(() => {
    if (batchFilter !== "all" && !batchOptions.includes(batchFilter)) {
      setBatchFilter("all");
    }
  }, [batchFilter, batchOptions]);

  useEffect(() => {
    if (boxFilter !== "all" && !boxOptions.includes(boxFilter)) {
      setBoxFilter("all");
    }
  }, [boxFilter, boxOptions]);
  const productStatusSteps = [
    { key: "registered", label: "Registered", icon: FaClipboardCheck },
    { key: "shipped", label: "Shipped", icon: FaTruck },
    { key: "verified", label: "Verified", icon: FaShieldAlt },
    { key: "sold", label: "Sold", icon: FaShoppingCart }
  ];

  const overviewCards = useMemo(
    () => [
      { key: "totalBatches", label: "Total Batch", icon: FaCube, value: stats.totalBatches },
      { key: "totalBoxes", label: "Total Box", icon: FaBoxes, value: stats.totalBoxes },
      { key: "totalProducts", label: "Total Product", icon: FaTag, value: stats.totalProducts },
      {
        key: "unverifiedProducts",
        label: "Unverified",
        icon: FaClock,
        value: products.filter((p) => !p.verified).length
      },
      {
        key: "inTransitProducts",
        label: "In Transit",
        icon: FaTruck,
        value: inTransitCount
      },
      {
        key: "unsoldProducts",
        label: "Unsold",
        icon: FaShoppingCart,
        value: unsoldCount
      },
      { key: "shippedProducts", label: "Shipped", icon: FaTruck, value: stats.shippedProducts },
      { key: "verifiedProducts", label: "Verified", icon: FaCheckCircle, value: stats.verifiedProducts },
      { key: "soldProducts", label: "Sold", icon: FaShoppingCart, value: stats.soldProducts }
    ],
    [stats, inTransitCount, unsoldCount, products]
  );

  const overviewPreview = useMemo(() => {
    const toProductRow = (p) => ({
      label: p.productId || "-",
      value: p.name || "-",
      meta: [p.batchId, p.boxId].filter(Boolean).join(" | ")
    });

    switch (selectedOverviewKey) {
      case "totalBatches":
        return {
          title: "Batch Preview",
          rows: Array.from(new Set(products.map((p) => p.batchId).filter(Boolean)))
            .slice(0, 12)
            .map((id, idx) => ({
              label: `Batch ${idx + 1}`,
              value: id
            }))
        };
      case "totalBoxes":
        return {
          title: "Box Preview",
          rows: Array.from(new Set(products.map((p) => p.boxId).filter(Boolean)))
            .slice(0, 12)
            .map((id, idx) => ({
              label: `Box ${idx + 1}`,
              value: id
            }))
        };
      case "totalProducts":
      case "unverifiedProducts":
      case "inTransitProducts":
      case "unsoldProducts":
      case "shippedProducts":
      case "verifiedProducts":
      case "soldProducts": {
        let filtered = [];
        let title = "Status Preview";

        if (selectedOverviewKey === "totalProducts") {
          title = "Product Preview";
          filtered = products;
        } else if (selectedOverviewKey === "unverifiedProducts") {
          title = "Unverified Product Preview";
          filtered = products.filter((p) => !p.verified);
        } else if (selectedOverviewKey === "inTransitProducts") {
          title = "In Transit Product Preview";
          filtered = products.filter((p) => p.shipped && !p.sold);
        } else if (selectedOverviewKey === "unsoldProducts") {
          title = "Unsold Product Preview";
          filtered = products.filter((p) => !p.sold);
        } else if (selectedOverviewKey === "shippedProducts") {
          title = "Shipped Product Preview";
          filtered = products.filter((p) => p.shipped);
        } else if (selectedOverviewKey === "verifiedProducts") {
          title = "Verified Product Preview";
          filtered = products.filter((p) => p.verified);
        } else if (selectedOverviewKey === "soldProducts") {
          title = "Sold Product Preview";
          filtered = products.filter((p) => p.sold);
        }

        return {
          title,
          rows: filtered.slice(0, 24).map(toProductRow)
        };
      }
      default:
        return { title: "Preview", rows: [] };
    }
  }, [selectedOverviewKey, products]);

  const previewToneClass = `admin-preview-key-${selectedOverviewKey}`;

  const startEditUser = (u) => {
    setEditingUserId(u.id);
    setEditingUser({ email: u.email, role: u.role, profileName: u.profileName || u.email });
  };

  const saveUser = async (id) => {
    try {
      await updateAdminUser(id, editingUser);
      setStatus("User updated.");
      setEditingUserId(null);
      setUsers(await fetchAdminUsers());
    } catch (err) {
      setStatus(err?.message || "User update failed");
    }
  };

  const handleDeleteUser = async (userRow) => {
    const roleLabel = String(userRow?.role || "").toUpperCase();
    if (!window.confirm(`Delete ${roleLabel} account ${userRow?.email || ""}?`)) return;

    try {
      setDeletingUserId(userRow.id);
      await deleteAdminUser(userRow.id);
      setStatus(`${roleLabel} account deleted.`);
      const [nextUsers, nextOverview] = await Promise.all([fetchAdminUsers(), fetchAdminOverview()]);
      setUsers(nextUsers);
      setOverview(nextOverview);
      if (editingUserId === userRow.id) {
        setEditingUserId(null);
      }
    } catch (err) {
      setStatus(err?.message || "User delete failed");
    } finally {
      setDeletingUserId(null);
    }
  };

  const getProductStageIndex = (product) => {
    if (product?.sold) return 3;
    if (product?.verified) return 2;
    if (product?.shipped) return 1;
    return 0;
  };

  if (!isAdmin) {
    return (
      <div className="dashboard admin-theme manufacturer-theme">
        <BackButton to="/login/admin" />
        <div className="dashboard-right" style={{ width: "100%" }}>
          <div className="premium-card">
            <h2 className="section-title"><FaShieldAlt /> Admin Access Required</h2>
            <p className="register-status">Only admin can open this dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard admin-theme manufacturer-theme">
      <BackButton to="/login/admin" />

      <div className="sidebar">
        <div className="sidebar-brand">
          <img src="/bc1.png" alt="TrustChain Logo" className="sidebar-brand-logo" />
          <h2 className="logo-gradient">TrustChain</h2>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">A</div>
          <div className="profile-meta">
            <div className="profile-name">Admin</div>
            <div className="profile-id">Master Control Panel</div>
          </div>
        </div>

        <div className={`sidebar-btn ${section === "overview" ? "active" : ""}`} onClick={() => setSection("overview")}>
          <FaShieldAlt /> Overview
        </div>
        <div className={`sidebar-btn ${section === "roles" ? "active" : ""}`} onClick={() => setSection("roles")}>
          <FaUsers /> Roles
        </div>
        <div className={`sidebar-btn ${section === "products" ? "active" : ""}`} onClick={() => setSection("products")}>
          <FaBoxes /> Products / Status
        </div>
        <div className={`sidebar-btn ${section === "analytics" ? "active" : ""}`} onClick={() => setSection("analytics")}>
          <FaChartLine /> Sales Analytics
        </div>
        <div className={`sidebar-btn ${section === "chain" ? "active" : ""}`} onClick={() => setSection("chain")}>
          <FaDatabase /> Blockchain Data
        </div>
      </div>

      <div className={`dashboard-right admin-right ${section === "overview" ? "admin-right-overview" : ""}`}>
        <div className="admin-toolbar">
          <h2 className="section-title"><FaShieldAlt /> Admin Command Center</h2>
        </div>

        {status && <div className="admin-status-msg">{status}</div>}

        {section === "overview" && (
          <div className="admin-overview-shell">
            <div className="admin-overview-left-col">
              <div className="premium-card admin-overview-card">
                <div className="admin-overview-layout">
                  <div className="admin-kpi-grid admin-kpi-grid-overview">
                    {overviewCards.map((card, idx) => {
                      const Icon = card.icon;
                      return (
                        <div
                          key={card.key}
                          className={`admin-kpi admin-kpi-eye admin-kpi-tone-${(idx % 6) + 1} admin-kpi-key-${card.key} ${selectedOverviewKey === card.key ? "active" : ""}`}
                          onClick={() => setSelectedOverviewKey(card.key)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedOverviewKey(card.key);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <span className="admin-kpi-label"><Icon /> {card.label}</span>
                          <strong>{card.value}</strong>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="admin-history-card admin-history-inside">
                  <h3><FaHistory /> Latest Product Activity</h3>
                  <div className="admin-history-list">
                    {(overview?.recentHistory || []).slice(0, 10).map((h) => (
                      <div key={`${h.productId}-${h.createdAt}`} className="admin-history-row">
                        <div>
                          <strong>{h.productId}</strong>
                          <span>{h.name}</span>
                        </div>
                        <div className="admin-history-flags">
                          <span className={h.shipped ? "ok" : "no"}>Shipped</span>
                          <span className={h.verified ? "ok" : "no"}>Verified</span>
                          <span className={h.sold ? "ok" : "no"}>Sold</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="premium-card admin-overview-preview-card">
              <div className={`admin-overview-preview ${previewToneClass}`}>
                <h3><FaEye /> Preview</h3>
                <div className="admin-overview-preview-title">{overviewPreview.title}</div>
                <div className="admin-overview-preview-list">
                  {overviewPreview.rows.length > 0 ? (
                    overviewPreview.rows.map((row, idx) => (
                      <div key={`${selectedOverviewKey}-${idx}`} className="admin-overview-preview-row">
                        <span className="admin-overview-preview-label">{row.label}</span>
                        <span className="admin-overview-preview-value">{row.value}</span>
                        {"meta" in row && row.meta ? (
                          <span className="admin-overview-preview-meta">{row.meta}</span>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="admin-overview-preview-row muted">No preview data.</div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {section === "roles" && (
          <div className="premium-card admin-users-card">
            <h3><FaUsers /> Roles</h3>

            <div className="admin-role-grid">
              <span className="admin-role-pill">
                <FaUsers /> Total Count <strong>{users.length}</strong>
              </span>
            </div>

            <div className="admin-role-grid">
              {roleTableConfig.map((roleItem) => {
                const Icon = roleItem.icon;
                const roleCount = roleUsers[roleItem.key]?.length || 0;
                return (
                  <button
                    key={roleItem.key}
                    className={`admin-role-pill admin-role-pill-click ${selectedRoleTable === roleItem.key ? "active" : ""}`}
                    onClick={() => setSelectedRoleTable(roleItem.key)}
                  >
                    <Icon /> {roleItem.label} <strong>{roleCount}</strong>
                  </button>
                );
              })}
            </div>

            {selectedRoleConfig ? (
              <>
                <div className="admin-table-search-row">
                  <input
                    className="admin-table-search-input"
                    placeholder={`Search ${selectedRoleConfig.label} table`}
                    value={roleSearchTerm}
                    onChange={(e) => setRoleSearchTerm(e.target.value)}
                  />
                </div>
                <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th><FaIdBadge /> ID</th>
                      <th><FaUser /> Email</th>
                      <th><FaShieldAlt /> Role</th>
                      <th><FaTag /> Profile Name</th>
                      <th><FaEdit /> Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoleUsers.map((u) => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>
                          {editingUserId === u.id ? (
                            <input value={editingUser.email} onChange={(e) => setEditingUser((p) => ({ ...p, email: e.target.value }))} />
                          ) : u.email}
                        </td>
                        <td>
                          {editingUserId === u.id ? (
                            <select value={editingUser.role} onChange={(e) => setEditingUser((p) => ({ ...p, role: e.target.value }))}>
                              <option>ADMIN</option>
                              <option>MANUFACTURER</option>
                              <option>RETAILER</option>
                              <option>USER</option>
                            </select>
                          ) : u.role}
                        </td>
                        <td>
                          {editingUserId === u.id ? (
                            <input value={editingUser.profileName} onChange={(e) => setEditingUser((p) => ({ ...p, profileName: e.target.value }))} />
                          ) : (u.profileName || "-")}
                        </td>
                        <td>
                          <div className="admin-action-group">
                            {editingUserId === u.id ? (
                              <button className="admin-action-btn" onClick={() => saveUser(u.id)}><FaSave /> Save</button>
                            ) : (
                              <button className="admin-action-btn" onClick={() => startEditUser(u)}><FaEdit /> Edit</button>
                            )}
                            <button
                              className="admin-action-btn admin-action-btn-danger"
                              onClick={() => handleDeleteUser(u)}
                              disabled={String(u.role || "").toUpperCase() === "ADMIN" || deletingUserId === u.id}
                              title={String(u.role || "").toUpperCase() === "ADMIN" ? "Admin delete is disabled" : "Delete user"}
                            >
                              <FaTrash /> {deletingUserId === u.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredRoleUsers.length && (
                      <tr>
                        <td colSpan="5" className="admin-empty-row"><FaUsers /> No matching {selectedRoleConfig.label.toLowerCase()} found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              </>
            ) : (
              <div className="admin-empty-row admin-chain-empty">
                <FaUsers /> Click a role to open its table.
              </div>
            )}
          </div>
        )}

        {section === "products" && (
          <div className="premium-card admin-products-card">
            <h3><FaBoxes /> Product Control (Direct Edit)</h3>
            <div className="admin-table-search-row admin-table-filter-row">
              <div className="admin-filter-field">
                <label className="admin-filter-label" htmlFor="admin-filter-manufacturer">Manufacturer</label>
                <select
                  id="admin-filter-manufacturer"
                  className="admin-table-search-input"
                  value={manufacturerFilter}
                  onChange={(e) => {
                    setManufacturerFilter(e.target.value);
                    setBatchFilter("all");
                    setBoxFilter("all");
                  }}
                >
                  <option value="all">All Manufacturers</option>
                  {manufacturerOptions.map((manufacturerName) => (
                    <option key={manufacturerName} value={manufacturerName}>
                      {manufacturerName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-filter-field">
                <label className="admin-filter-label" htmlFor="admin-filter-batch">Batch</label>
                <select
                  id="admin-filter-batch"
                  className="admin-table-search-input"
                  value={batchFilter}
                  onChange={(e) => {
                    setBatchFilter(e.target.value);
                    setBoxFilter("all");
                  }}
                >
                  <option value="all">All Batches</option>
                  {batchOptions.map((batchId) => (
                    <option key={batchId} value={batchId}>
                      {batchId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-filter-field">
                <label className="admin-filter-label" htmlFor="admin-filter-box">Box</label>
                <select
                  id="admin-filter-box"
                  className="admin-table-search-input"
                  value={boxFilter}
                  onChange={(e) => setBoxFilter(e.target.value)}
                >
                  <option value="all">All Boxes</option>
                  {boxOptions.map((boxId) => (
                    <option key={boxId} value={boxId}>
                      {boxId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-filter-field">
                <label className="admin-filter-label" htmlFor="admin-filter-from-date">From Date</label>
                <input
                  id="admin-filter-from-date"
                  className="admin-table-search-input"
                  type="date"
                  value={fromDateFilter}
                  onChange={(e) => setFromDateFilter(e.target.value)}
                  title="From date"
                />
              </div>

              <div className="admin-filter-field">
                <label className="admin-filter-label" htmlFor="admin-filter-to-date">To Date</label>
                <input
                  id="admin-filter-to-date"
                  className="admin-table-search-input"
                  type="date"
                  value={toDateFilter}
                  onChange={(e) => setToDateFilter(e.target.value)}
                  title="To date"
                />
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th><FaIndustry /> Manufacturer</th>
                    <th><FaCube /> Batch</th>
                    <th><FaBoxes /> Box</th>
                    <th><FaTag /> Products</th>
                    <th><FaClipboardCheck /> Registered</th>
                    <th><FaIdBadge /> Product IDs</th>
                  </tr>
                </thead>
                <tbody>
                  {manufacturerBatchBoxSummary.flatMap((manufacturerRow) =>
                    manufacturerRow.batches.flatMap((batchRow) =>
                      batchRow.boxes.map((boxRow) => (
                        <tr key={`${manufacturerRow.manufacturer}-${batchRow.batchId}-${boxRow.boxId}`}>
                          <td>{manufacturerRow.manufacturer}</td>
                          <td>{batchRow.batchId}</td>
                          <td>{boxRow.boxId}</td>
                          <td>{boxRow.totalProducts}</td>
                          <td>{boxRow.registeredProducts}</td>
                          <td>{boxRow.productIds.join(", ")}</td>
                        </tr>
                      ))
                    )
                  )}
                  {!manufacturerBatchBoxSummary.length && (
                    <tr>
                      <td colSpan="6" className="admin-empty-row"><FaBoxes /> No manufacturer-wise records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="admin-table-search-row">
              <input
                className="admin-table-search-input"
                placeholder="Search product table (ID, name, batch, box, retailer, status...)"
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
              />
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th><FaTag /> Product</th>
                    <th><FaUserTag /> Retailer</th>
                    <th><FaMapMarkerAlt /> Location</th>
                    <th><FaDollarSign /> Price</th>
                    <th><FaTruck /> Shipped</th>
                    <th><FaCheckCircle /> Verified</th>
                    <th><FaShoppingCart /> Sold</th>
                    <th><FaEye /> Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const isExpanded = viewingProductId === p.productId;
                    const currentStage = getProductStageIndex(p);
                    const progressValue = `${(currentStage / 3) * 100}%`;
                    return (
                      <React.Fragment key={p.productId}>
                        <tr className={isExpanded ? "admin-product-row-open" : ""}>
                          <td><strong>{p.productId}</strong><span>{p.name}</span></td>
                          <td>{p.retailerId || "-"}</td>
                          <td>{p.retailerLocation || "-"}</td>
                          <td>{p.price}</td>
                          <td>{p.shipped ? "Yes" : "No"}</td>
                          <td>{p.verified ? "Yes" : "No"}</td>
                          <td>{p.sold ? "Yes" : "No"}</td>
                          <td>
                            <div className="admin-action-group">
                              <button
                                className={`admin-action-btn admin-action-btn-secondary ${isExpanded ? "active" : ""}`}
                                onClick={() => setViewingProductId((prev) => (prev === p.productId ? "" : p.productId))}
                              >
                                <FaEye /> {isExpanded ? "Hide" : "View"}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="admin-product-expand-row">
                            <td colSpan="8" className="admin-product-expand-cell">
                              <div className={`admin-product-inline-panel ${p.sold ? "is-sold" : p.verified ? "is-verified" : ""}`}>
                                <div className="admin-product-inline-head">
                                  <div>
                                    <h4><FaEye /> Product Details</h4>
                                    <p>{p.productId} | {p.name || "Unnamed Product"}</p>
                                  </div>
                                </div>

                                <div className="admin-product-status-rail" style={{ "--status-progress": progressValue }}>
                                  <div className="admin-product-status-progress" />
                                  {productStatusSteps.map((step, idx) => {
                                    const Icon = step.icon;
                                    const active = idx <= currentStage;
                                    const isCurrent = idx === currentStage;
                                    const isComplete = idx < currentStage || (currentStage === 3 && idx === 3);
                                    return (
                                      <div key={step.key} className={`admin-product-status-node ${active ? "active" : ""} ${isCurrent ? "current" : ""}`}>
                                        <span className="admin-product-status-icon-wrap">
                                          <Icon className="admin-product-status-icon" />
                                          {isCurrent && currentStage < 3 && <FaSyncAlt className="admin-product-status-loader" />}
                                        </span>
                                        <span>{step.label}</span>
                                        {(isComplete || isCurrent) && (
                                          <span className={`admin-product-status-tick ${isComplete ? "complete" : "pending"}`}>
                                            <FaCheckCircle />
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="admin-product-inline-body">
                                  <div className="admin-product-inline-media">
                                    <img src={p.image || "/mob.jpg"} alt={p.name || "Product"} />
                                  </div>
                                  <div className="admin-product-inline-grid">
                                    <p><strong>Category:</strong> {p.category || "-"}</p>
                                    <p><strong>Model Number:</strong> {p.modelNumber || "-"}</p>
                                    <p><strong>Serial Number:</strong> {p.serialNumber || "-"}</p>
                                    <p><strong>Color:</strong> {p.color || "-"}</p>
                                    <p><strong>Price:</strong> {p.price ?? 0}</p>
                                    <p><strong>Warranty:</strong> {p.warrantyPeriod || "-"}</p>
                                    <p><strong>Batch ID:</strong> {p.batchId || "-"}</p>
                                    <p><strong>Box ID:</strong> {p.boxId || "-"}</p>
                                    <p><strong>Manufacturer:</strong> {p.manufacturer || "-"}</p>
                                    <p><strong>Manufacture Place:</strong> {p.manufacturePlace || "-"}</p>
                                    <p><strong>Retailer:</strong> {p.retailerId || "-"}</p>
                                    <p><strong>Retailer Location:</strong> {p.retailerLocation || "-"}</p>
                                    <p><strong>Registered:</strong> {p.registered ? "Yes" : "No"}</p>
                                    <p><strong>Shipped:</strong> {p.shipped ? "Yes" : "No"}</p>
                                    <p><strong>Verified:</strong> {p.verified ? "Yes" : "No"}</p>
                                    <p><strong>Sold:</strong> {p.sold ? "Yes" : "No"}</p>
                                    <p><strong>Created At:</strong> {p.createdAt ? new Date(p.createdAt).toLocaleString() : "-"}</p>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {!products.length && (
                    <tr>
                      <td colSpan="8" className="admin-empty-row"><FaBoxes /> No product data found.</td>
                    </tr>
                  )}
                  {!!products.length && !filteredProducts.length && (
                    <tr>
                      <td colSpan="8" className="admin-empty-row"><FaBoxes /> No matching products found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {section === "analytics" && (
          <div className="premium-card admin-analytics-card">
            <div className="admin-analytics-head">
              <h3><FaChartLine /> Sales Intelligence</h3>
              <select value={analyticsRange} onChange={(e) => setAnalyticsRange(e.target.value)}>
                <option value="week">Latest 7 Days</option>
                <option value="month">Latest 30 Days</option>
              </select>
            </div>

            <div className="admin-analytics-kpi-grid">
              <div className="admin-analytics-kpi admin-analytics-kpi-revenue">
                <span><FaDollarSign /> Realized Revenue</span>
                <strong>{formatMoney(soldRevenue)}</strong>
                <small>{soldProductsCount} sold products</small>
              </div>
              <div className={`admin-analytics-kpi admin-analytics-kpi-growth ${growthTone}`}>
                <span>{growthTone === "up" ? <FaArrowUp /> : <FaArrowDown />} Growth Trend</span>
                <strong>{growthAbs}%</strong>
                <small>{momentumLabel}</small>
              </div>
              <div className="admin-analytics-kpi admin-analytics-kpi-conversion">
                <span><FaBullseye /> Sell-Through</span>
                <strong>{sellThroughRate.toFixed(1)}%</strong>
                <small>Shipped to sold: {shippedToSoldRate.toFixed(1)}%</small>
              </div>
              <div className="admin-analytics-kpi admin-analytics-kpi-price">
                <span><FaRocket /> Avg Selling Price</span>
                <strong>{formatMoney(avgSellingPrice)}</strong>
                <small>Verified to sold: {verifiedToSoldRate.toFixed(1)}%</small>
              </div>
            </div>

            <div className="admin-analytics-main-grid">
              <div className="admin-analytics-left-stack">
                <div className="admin-chart-panel admin-chart-premium">
                  <h4>Demand Curve ({analyticsRange})</h4>
                  <MiniAreaChart points={dailySales} />
                </div>
              </div>

              <div className="admin-analytics-funnel-card">
                <h4><FaChartPie /> Conversion Funnel</h4>
                <div className="admin-analytics-funnel-list">
                  {analyticsFunnel.map((stage) => {
                    const Icon = stage.icon;
                    const width = `${Math.max(8, Math.round((stage.value / funnelBase) * 100))}%`;
                    return (
                      <div key={stage.key} className="admin-analytics-funnel-row">
                        <div className="admin-analytics-funnel-label">
                          <Icon />
                          <span>{stage.label}</span>
                        </div>
                        <div className="admin-analytics-funnel-track">
                          <i style={{ width }} />
                        </div>
                        <strong>{stage.value}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="admin-area-bars admin-area-bars-premium">
              <h4><FaMapMarkerAlt /> Selling Area Distribution</h4>
              {(areaInsights.sorted || []).map((a) => {
                const max = Math.max(...(areaInsights.sorted || []).map((x) => x.soldCount), 1);
                const w = `${Math.round((a.soldCount / max) * 100)}%`;
                return (
                  <div key={a.area} className="admin-area-row">
                    <span>{a.area}</span>
                    <div className="admin-area-track"><i style={{ width: w }} /></div>
                    <strong>{a.soldCount}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {section === "chain" && (
          <div className="premium-card admin-chain-card">
            <div className="admin-analytics-head">
              <h3><FaDatabase /> Blockchain Blocks</h3>
            </div>
            {chainLastUpdated && (
              <div className="admin-chain-updated">Last updated: {chainLastUpdated.toLocaleString()}</div>
            )}

            {!chainBlocks.length && (
              <div className="admin-empty-row admin-chain-empty">
                <FaCube /> Waiting for blockchain blocks...
              </div>
            )}

            {!!chainBlocks.length && (
              <div className="admin-block-grid">
                {chainBlocks.map((b) => (
                  <div key={b.blockNumber} className="admin-block-card">
                    <h4><FaCube /> BLOCK #{b.blockNumber}</h4>
                    <p><FaClock /> <strong>Time:</strong> {b.timestamp ? new Date(b.timestamp).toLocaleString() : "-"}</p>
                    <p><FaShoppingCart /> <strong>Transactions:</strong> {b.txCount}</p>
                    <p><FaTruck /> <strong>Gas Used:</strong> {b.gasUsed}</p>
                    <p><FaCheckCircle /> <strong>Gas Limit:</strong> {b.gasLimit}</p>
                    <p className="admin-block-hash"><FaLink /> <strong>Hash:</strong> {b.hash || "-"}</p>
                    <p className="admin-block-hash"><FaLink /> <strong>Parent:</strong> {b.parentHash || "-"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
