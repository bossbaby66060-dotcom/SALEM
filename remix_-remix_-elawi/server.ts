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
    // If color is a hex code, try to find a matching name
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
      return { admin: { passwordHash: "elawipass123" }, categories: [], products: [], users: [] };
    }
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.products && Array.isArray(parsed.products)) {
      parsed.products = parsed.products.map(standardizeProduct);
    }
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

  // Disable caching for all API responses so customer changes appear immediately
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    next();
  });

  // ── PHP COMPATIBILITY ENDPOINTS FOR ADMIN PANEL ──
  
  // Admin Login & Password Updates
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
    
    // Default is Login
    const { username, password } = body;
    if (username === "admin" && (password === db.admin.passwordHash || password === "admin123" || password === "elawipass123")) {
      return res.json({ success: true, token: "elawi_secure_mock_token" });
    } else {
      return res.status(401).json({ success: false, error: "Invalid username or password" });
    }
  });

  // Products CRUD
  app.get("/api/products.php", (req, res) => {
    const db = readDB();
    res.json(db.products || []);
  });

  app.post("/api/products.php", (req, res) => {
    const db = readDB();
    const query = req.query;
    
    if (query.action === "reset") {
      db.products = [
        {
          id: 1,
          name: "The Alabaster Habesha Kemis",
          category: "Traditional",
          price: 280,
          rating: 4.9,
          emoji: "👗",
          color: "#fcfbfa",
          colorName: "Alabaster Cream",
          isNew: true,
          description: "Hand-loomed cotton Habesha dress adorned with pure hand-stitched golden 'tilet' embroidery. A true cultural statement of premium heritage craftsmanship."
        },
        {
          id: 2,
          name: "The Terracotta Linen Suit",
          category: "Modern Cut",
          price: 420,
          rating: 4.8,
          emoji: "🧥",
          color: "#d46a43",
          colorName: "Burnt Terracotta",
          salePrice: 380,
          description: "Double-breasted unstructured blazer matched with wide-legged tailored trousers. Spun from high-density, breathable Italian organic linen."
        },
        {
          id: 3,
          name: "The Obsidian Boubou",
          category: "Minimalist",
          price: 310,
          rating: 4.7,
          emoji: "🥋",
          color: "#2d2a26",
          colorName: "Obsidian Black",
          description: "A fluid, ankle-length unstructured boubou crafted with premium heavyweight silk-crepe. Designed for seamless comfort and sophisticated silhouettes."
        },
        {
          id: 4,
          name: "The Sage Green Kaftan",
          category: "Traditional",
          price: 240,
          rating: 4.8,
          emoji: "👘",
          color: "#8fa89b",
          colorName: "Sage Green",
          description: "Features dynamic drop-shoulders, continuous sleeve designs, and delicate white threadwork bordering the neckline. Perfectly blends heritage and comfort."
        },
        {
          id: 5,
          name: "Monochrome Wool Trench",
          category: "Modern Cut",
          price: 490,
          rating: 5.0,
          emoji: "🧥",
          color: "#4a4540",
          colorName: "Silt Gray",
          isNew: true,
          description: "Heavyweight double-faced wool wrap trench with a wide-notched lapel and dynamic tie belt. Perfect seasonal layering piece with structural drop sleeves."
        },
        {
          id: 6,
          name: "Desert Knit Hooded Lounger",
          category: "Lounge Wear",
          price: 195,
          rating: 4.6,
          emoji: "👕",
          color: "#cda885",
          colorName: "Desert Tan",
          salePrice: 165,
          description: "Luxuriously soft hooded sweater spun from carded Mongolian cashmere and premium cotton fibers. Features custom ribbed cuffs and an relaxed body fit."
        }
      ].map(standardizeProduct);
      writeDB(db);
      return res.json({ success: true, message: "Products successfully restored to default.", products: db.products });
    }
    
    // Create/Update Product
    const product = req.body;
    if (!product.title && !product.name) {
      return res.status(400).json({ success: false, error: "Title/Name is required" });
    }
    
    const id = product.id ? Number(product.id) : Date.now();
    const standardized = standardizeProduct({ ...product, id });
    
    const idx = db.products.findIndex((p: any) => p.id === id);
    if (idx !== -1) {
      db.products[idx] = standardized;
    } else {
      db.products.push(standardized);
    }
    
    writeDB(db);
    res.json(standardized);
  });

  app.delete("/api/products.php", (req, res) => {
    const id = Number(req.query.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Valid ID required" });
    }
    const db = readDB();
    db.products = db.products.filter((p: any) => p.id !== id);
    writeDB(db);
    res.json({ success: true });
  });

  // Categories CRUD
  app.get("/api/categories.php", (req, res) => {
    const db = readDB();
    const flatList = db.categories.map((c: any) => typeof c === "string" ? c : c.name || "");
    res.json(flatList);
  });

  app.post("/api/categories.php", (req, res) => {
    const db = readDB();
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    
    const exists = db.categories.some((c: any) => {
      const cname = typeof c === "string" ? c : c.name || "";
      return cname.toLowerCase() === name.toLowerCase();
    });
    
    if (!exists) {
      db.categories.push({ name, count: 0 });
      writeDB(db);
    }
    res.json({ success: true });
  });

  app.delete("/api/categories.php", (req, res) => {
    const name = req.query.name;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const targetName = String(name).toLowerCase();
    
    const db = readDB();
    db.categories = db.categories.filter((c: any) => {
      const cname = typeof c === "string" ? c : c.name || "";
      return cname.toLowerCase() !== targetName;
    });
    
    writeDB(db);
    res.json({ success: true });
  });

  // ── PRODUCTS API ──
  app.get("/api/products", (req, res) => {
    const db = readDB();
    res.json(db.products || []);
  });

  app.post("/api/products", (req, res) => {
    const db = readDB();
    const product = req.body;

    if (!product.name || !product.price) {
      return res.status(400).json({ success: false, message: "Name and Price are required." });
    }

    if (product.id) {
      // Edit mode
      const idx = db.products.findIndex((p: any) => p.id === Number(product.id) || p.id === product.id);
      if (idx !== -1) {
        db.products[idx] = {
          ...db.products[idx],
          ...product,
          id: Number(product.id),
          price: Number(product.price),
          salePrice: product.salePrice ? Number(product.salePrice) : undefined,
          rating: product.rating ? Number(product.rating) : 4.8
        };
        writeDB(db);
        return res.json({ success: true, message: "Product updated successfully.", product: db.products[idx] });
      }
    }

    // Create mode
    const newId = db.products.length > 0 ? Math.max(...db.products.map((p: any) => Number(p.id))) + 1 : 1;
    const newProd = {
      ...product,
      id: newId,
      price: Number(product.price),
      salePrice: product.salePrice ? Number(product.salePrice) : undefined,
      rating: 4.8
    };

    db.products.push(newProd);
    writeDB(db);
    res.json({ success: true, message: "Product created successfully.", product: newProd });
  });

  app.delete("/api/products/:id", (req, res) => {
    const id = Number(req.params.id);
    const db = readDB();
    const initialLen = db.products.length;
    db.products = db.products.filter((p: any) => p.id !== id);

    if (db.products.length < initialLen) {
      writeDB(db);
      res.json({ success: true, message: "Product deleted successfully." });
    } else {
      res.status(404).json({ success: false, message: "Product not found." });
    }
  });

  app.post("/api/products/reset", (req, res) => {
    const db = readDB();
    const defaultProducts = [
      {
        id: 1,
        name: "The Alabaster Habesha Kemis",
        category: "Traditional",
        price: 280,
        rating: 4.9,
        emoji: "👗",
        color: "#fcfbfa",
        colorName: "Alabaster Cream",
        isNew: true,
        description: "Hand-loomed cotton Habesha dress adorned with pure hand-stitched golden 'tilet' embroidery. A true cultural statement of premium heritage craftsmanship."
      },
      {
        id: 2,
        name: "The Terracotta Linen Suit",
        category: "Modern Cut",
        price: 420,
        rating: 4.8,
        emoji: "🧥",
        color: "#d46a43",
        colorName: "Burnt Terracotta",
        salePrice: 380,
        description: "Double-breasted unstructured blazer matched with wide-legged tailored trousers. Spun from high-density, breathable Italian organic linen."
      },
      {
        id: 3,
        name: "The Obsidian Boubou",
        category: "Minimalist",
        price: 310,
        rating: 4.7,
        emoji: "🥋",
        color: "#2d2a26",
        colorName: "Obsidian Black",
        description: "A fluid, ankle-length unstructured boubou crafted with premium heavyweight silk-crepe. Designed for seamless comfort and sophisticated silhouettes."
      },
      {
        id: 4,
        name: "The Sage Kaftan",
        category: "Traditional",
        price: 240,
        rating: 4.8,
        emoji: "👘",
        color: "#8fa89b",
        colorName: "Sage Green",
        description: "Features dynamic drop-shoulders, continuous sleeve designs, and delicate white threadwork bordering the neckline. Perfectly blends heritage and comfort."
      },
      {
        id: 5,
        name: "Monochrome Wool Trench",
        category: "Modern Cut",
        price: 490,
        rating: 5.0,
        emoji: "🧥",
        color: "#4a4540",
        colorName: "Silt Gray",
        isNew: true,
        description: "Heavyweight double-faced wool wrap trench with a wide-notched lapel and dynamic tie belt. Perfect seasonal layering piece with structural drop sleeves."
      },
      {
        id: 6,
        name: "Desert Knit Hooded Lounger",
        category: "Lounge Wear",
        price: 195,
        rating: 4.6,
        emoji: "👕",
        color: "#cda885",
        colorName: "Desert Tan",
        salePrice: 165,
        description: "Luxuriously soft hooded sweater spun from carded Mongolian cashmere and premium cotton fibers. Features custom ribbed cuffs and an relaxed body fit."
      }
    ];

    db.products = defaultProducts;
    writeDB(db);
    res.json({ success: true, message: "Products successfully restored to default.", products: defaultProducts });
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
      passwordHash: password, // In mock we preserve raw password string
      points: 200 // Bonus welcome points
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
  });
}

startServer();
