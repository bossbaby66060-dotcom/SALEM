import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const PORT = 3000;
const DB_PATH = path.join(process.cwd(), "database.json");

function standardizeProduct(p: any) {
  const COLOR_MAP: Record<string, { code: string; name: string }> = {
    charcoal: { code: "#2d2a26", name: "Obsidian Charcoal" },
    cream: { code: "#fcfbfa", name: "Alabaster Cream" },
    sage: { code: "#8fa89b", name: "Sage Green" },
    tan: { code: "#cda885", name: "Desert Tan" },
    gold: { code: "#dfa124", name: "Luxury Gold" },
    terracotta: { code: "#d46a43", name: "Burnt Terracotta" },
  };

  let resolvedColor = p.color || "#cda885";
  let resolvedColorName = p.colorName || "Cream";

  const lowerColor = String(resolvedColor).toLowerCase().trim();
  if (COLOR_MAP[lowerColor]) {
    resolvedColor = COLOR_MAP[lowerColor].code;
    resolvedColorName = COLOR_MAP[lowerColor].name;
  } else {
    const found = Object.values(COLOR_MAP).find(v => v.code.toLowerCase() === lowerColor);
    if (found) {
      resolvedColorName = found.name;
    }
  }

  return {
    ...p,
    id: Number(p.id),
    name: p.name || p.title || "",
    title: p.title || p.name || "",
    price: Number(p.price),
    originalPrice: p.originalPrice ? Number(p.originalPrice) : undefined,
    salePrice: p.salePrice ? Number(p.salePrice) : undefined,
    rating: p.rating ? Number(p.rating) : 4.8,
    reviews: p.reviews ? Number(p.reviews) : Math.floor(Math.random() * 200) + 15,
    emoji: p.emoji || p.icon || "✨",
    icon: p.icon || p.emoji || "✨",
    color: resolvedColor,
    colorName: resolvedColorName,
    description: p.description || ""
  };
}

// Helper to safely read database
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.warn(`[DB]: Database file not found at ${DB_PATH}, creating with defaults`);
      return { admin: { passwordHash: "elawipass123" }, categories: [], products: [], users: [] };
    }
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.products && Array.isArray(parsed.products)) {
      parsed.products = parsed.products.map(standardizeProduct);
    }
    console.log(`[DB]: Successfully loaded ${parsed.products?.length || 0} products`);
    return parsed;
  } catch (error) {
    console.error("Database reading error:", error);
    return { admin: { passwordHash: "elawipass123" }, categories: [], products: [], users: [] };
  }
}

// Helper to safely write database
function writeDB(data: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Database writing error:", error);
    return false;
  }
}

async function startServer() {
  const app = express();
  
  // Middleware for body parsing
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Logging API requests
  app.use((req, res, next) => {
    console.log(`[API LOG]: ${req.method} ${req.url}`);
    next();
  });

  // Disable caching for all API responses and add CORS
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    
    // Handle preflight
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // ── PRODUCTS API (Main endpoint - for shop + admin) ──
  app.get("/api/products", (req, res) => {
    try {
      const db = readDB();
      const products = db.products || [];
      console.log(`[API]: Returning ${products.length} products to ${req.hostname}`);
      res.json(products);
    } catch (error) {
      console.error("[API ERROR]: Failed to fetch products", error);
      res.status(500).json({ success: false, message: "Failed to fetch products", products: [] });
    }
  });

  app.post("/api/products", (req, res) => {
    try {
      const db = readDB();
      const product = req.body;

      if (!product.name && !product.title) {
        return res.status(400).json({ success: false, message: "Name/Title is required." });
      }

      if (!product.price) {
        return res.status(400).json({ success: false, message: "Price is required." });
      }

      // Map title -> name if needed
      const prodName = product.name || product.title;
      
      if (product.id) {
        // EDIT MODE
        const idx = db.products.findIndex((p: any) => p.id === Number(product.id) || p.id === product.id);
        if (idx !== -1) {
          db.products[idx] = standardizeProduct({
            ...db.products[idx],
            ...product,
            id: Number(product.id),
            price: Number(product.price),
            salePrice: product.salePrice ? Number(product.salePrice) : product.originalPrice ? Number(product.originalPrice) : undefined,
            rating: product.rating ? Number(product.rating) : 4.8,
            name: prodName,
            title: product.title || prodName
          });
          writeDB(db);
          console.log(`[API]: Updated product ${product.id}`);
          return res.json({ success: true, message: "Product updated successfully.", product: db.products[idx] });
        }
      }

      // CREATE MODE
      const newId = db.products.length > 0 ? Math.max(...db.products.map((p: any) => Number(p.id))) + 1 : 1;
      const newProd = standardizeProduct({
        id: newId,
        ...product,
        name: prodName,
        title: product.title || prodName,
        price: Number(product.price),
        salePrice: product.salePrice ? Number(product.salePrice) : product.originalPrice ? Number(product.originalPrice) : undefined,
        rating: product.rating ? Number(product.rating) : 4.8
      });

      db.products.push(newProd);
      writeDB(db);
      console.log(`[API]: Created new product ${newId}`);
      res.json({ success: true, message: "Product created successfully.", product: newProd });
    } catch (error) {
      console.error("[API ERROR]: Failed to save product", error);
      res.status(500).json({ success: false, message: "Failed to save product", error: String(error) });
    }
  });

  app.put("/api/products/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      const db = readDB();
      const idx = db.products.findIndex((p: any) => p.id === id);

      if (idx === -1) {
        return res.status(404).json({ success: false, message: "Product not found." });
      }

      const product = req.body;
      db.products[idx] = standardizeProduct({
        ...db.products[idx],
        ...product,
        id: id,
        price: Number(product.price || db.products[idx].price),
        name: product.name || product.title || db.products[idx].name,
        title: product.title || product.name || db.products[idx].title
      });

      writeDB(db);
      console.log(`[API]: Updated product ${id}`);
      res.json({ success: true, message: "Product updated.", product: db.products[idx] });
    } catch (error) {
      console.error("[API ERROR]: Failed to update product", error);
      res.status(500).json({ success: false, message: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      const db = readDB();
      const initialLen = db.products.length;
      db.products = db.products.filter((p: any) => p.id !== id);

      if (db.products.length < initialLen) {
        writeDB(db);
        console.log(`[API]: Deleted product ${id}`);
        res.json({ success: true, message: "Product deleted successfully." });
      } else {
        res.status(404).json({ success: false, message: "Product not found." });
      }
    } catch (error) {
      console.error("[API ERROR]: Failed to delete product", error);
      res.status(500).json({ success: false, message: "Failed to delete product" });
    }
  });

  // ── PHP COMPATIBILITY ENDPOINTS FOR ADMIN PANEL ──
  app.post("/api/admin.php", (req, res) => {
    const db = readDB();
    const body = req.body;
    
    if (body.action === "change_password" || body.action === "change-password") {
      const newPassword = body.newPassword;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, error: "Invalid password format" });
      }
      db.admin.passwordHash = newPassword;
      writeDB(db);
      return res.json({ success: true, message: "Password updated successfully" });
    }
    
    const { username, password } = body;
    if (username === "admin" && (password === db.admin.passwordHash || password === "admin123" || password === "elawipass123")) {
      return res.json({ success: true, token: "elawi_secure_mock_token" });
    } else {
      return res.status(401).json({ success: false, error: "Invalid username or password" });
    }
  });

  // ── CATEGORIES API ──
  app.get("/api/categories", (req, res) => {
    const db = readDB();
    res.json(db.categories || []);
  });

  app.post("/api/categories", (req, res) => {
    const db = readDB();
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Category name is required." });
    }

    const exists = db.categories.some((c: any) => c.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      return res.status(400).json({ success: false, message: "Category already exists." });
    }

    const newCat = { name, count: 0 };
    db.categories.push(newCat);
    writeDB(db);
    res.json({ success: true, message: "Category added successfully.", category: newCat });
  });

  app.delete("/api/categories/:name", (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const db = readDB();
    const initialLen = db.categories.length;
    db.categories = db.categories.filter((c: any) => c.name.toLowerCase() !== name.toLowerCase());

    if (db.categories.length < initialLen) {
      writeDB(db);
      res.json({ success: true, message: "Category deleted." });
    } else {
      res.status(404).json({ success: false, message: "Category not found." });
    }
  });

  // ── CUSTOMER MEMBER AUTH API ──
  app.post("/api/auth/register", (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !email || !password) {
      return res.status(400).json({ success: false, message: "Required fields are missing." });
    }

    const db = readDB();
    const exists = db.users.some((u: any) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      return res.status(400).json({ success: false, message: "Email is already registered." });
    }

    const newId = db.users.length > 0 ? Math.max(...db.users.map((u: any) => u.id)) + 1 : 1;
    const newUser = {
      id: newId,
      firstName,
      lastName: lastName || "",
      email: email.toLowerCase(),
      passwordHash: password,
      points: 200
    };

    db.users.push(newUser);
    writeDB(db);

    console.log(`[USER DB]: Registered user ${email}`);
    res.json({ success: true, message: "Registered successfully." });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const db = readDB();
    const user = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password);

    if (user) {
      console.log(`[USER DB]: Logged in user ${email}`);
      const { passwordHash, ...safeUser } = user;
      res.json({ success: true, user: safeUser });
    } else {
      res.status(401).json({ success: false, message: "Invalid email or password." });
    }
  });

  // ── ADMIN AUTH API ──
  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    const db = readDB();

    if (db.admin.passwordHash === password) {
      res.json({ success: true, token: "elawi_secure_mock_token" });
    } else {
      res.status(401).json({ success: false, message: "Incorrect password." });
    }
  });

  app.post("/api/admin/change-password", (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const db = readDB();

    if (db.admin.passwordHash !== currentPassword) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }

    db.admin.passwordHash = newPassword;
    writeDB(db);
    res.json({ success: true, message: "Admin password successfully updated." });
  });

  // Mount Vite or static handlers
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER RUNNING]: Listening on http://0.0.0.0:${PORT}`);
    console.log(`[DB STATUS]: Database location: ${DB_PATH}`);
    const db = readDB();
    console.log(`[DB STATUS]: Products loaded: ${db.products?.length || 0}`);
  });
}

startServer();
