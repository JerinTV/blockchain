import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../prismaClient.js";

const router = express.Router();
const ALLOWED_ROLES = new Set(["ADMIN", "MANUFACTURER", "RETAILER", "USER"]);

/* ================= REGISTER ================= */
router.post("/register", async (req, res) => {
  const { username, email, password, role } = req.body;
  const normalizedRole = String(role || "").trim().toUpperCase();
  const normalizedUsername = String(username || "").trim();

  if (!normalizedUsername || !email || !password || !role)
    return res.status(400).json({ error: "All fields required" });

  if (!ALLOWED_ROLES.has(normalizedRole))
    return res.status(400).json({ error: "Invalid role" });

  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing)
    return res.status(400).json({ error: "User already exists" });

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      username: normalizedUsername,
      email,
      password: hashed,
      role: normalizedRole
    }
  });

  res.json({ message: "User registered", role: user.role.toLowerCase() });
});


/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  const { email, password, role } = req.body;
  const normalizedRole = String(role || "").trim().toUpperCase();

  if (!email || !password || !role)
    return res.status(400).json({ error: "All fields required" });

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user)
    return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid)
    return res.status(401).json({ error: "Invalid credentials" });

  // 🔥 ROLE CHECK
  if (user.role !== normalizedRole) {
    return res.status(403).json({
      error: `Access denied for ${role} portal`
    });
  }

  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({ token, role: user.role.toLowerCase() });
});


export default router;
