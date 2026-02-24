import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../prismaClient.js";

const router = express.Router();
const VALID_ROLES = ["ADMIN", "MANUFACTURER", "RETAILER", "USER"];

function normalizeRole(role) {
  return String(role || "").trim().toUpperCase();
}

/* ================= REGISTER ================= */
router.post("/register", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const normalizedRole = normalizeRole(role);

    if (!email || !password || !normalizedRole)
      return res.status(400).json({ error: "All fields required" });

    if (!VALID_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // check existing email
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser)
      return res.status(400).json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        role: normalizedRole
      }
    });

    // Keep role profile tables in sync with auth users.
    if (normalizedRole === "RETAILER") {
      await prisma.retailer.upsert({
        where: { userId: user.id },
        update: { name: email },
        create: { userId: user.id, name: email }
      });
    } else if (normalizedRole === "MANUFACTURER") {
      await prisma.manufacturer.upsert({
        where: { userId: user.id },
        update: { name: email },
        create: { userId: user.id, name: email }
      });
    }

    res.json({
      message: "User registered",
      role: user.role.toLowerCase()
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const normalizedRole = normalizeRole(role);

    if (!username || !password || !normalizedRole)
      return res.status(400).json({ error: "All fields required" });

    const user = await prisma.user.findUnique({
      where: { email: username }
    });

    if (!user)
      return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: "Invalid credentials" });

    if (user.role !== normalizedRole)
      return res.status(403).json({
        error: `Access denied for ${role} portal`
      });

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      role: user.role.toLowerCase()
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
