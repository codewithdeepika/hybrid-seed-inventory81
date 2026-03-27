require('dotenv').config();
const express = require("express");
const mysql = require("mysql2/promise"); // ✅ CHANGED FROM PG
const path = require("path");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ MYSQL CONNECTION (USING YOUR CONFIG)
const pool = mysql.createPool({
  host: 'metro.proxy.rlwy.net',
  user: 'root',
  password: 'CrVoNGADaLiIaymHquhOQUYLIOYeZwHf',
  database: 'railway',
  port: 54447,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Database Initialization
async function initializeDatabase() {
  try {
    const queries = [
      `CREATE TABLE IF NOT EXISTS inward (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seedName VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        party VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS outward (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seedName VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        party VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS returns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seedName VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS expiry (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seedName VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        expiryDate DATE NOT NULL,
        action VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const query of queries) {
      await pool.query(query);
    }

    console.log("✅ Database tables initialized");
  } catch (err) {
    console.error("❌ Database initialization failed:", err);
    process.exit(1);
  }
}

// Helper function
const handleDbError = (res, err) => {
  console.error("Database error:", err);
  res.status(500).json({ error: "Database operation failed", details: err.message });
};

// ✅ API ROUTES (UPDATED FOR MYSQL)

// INSERT
app.post("/api/inward", async (req, res) => {
  try {
    const { seedName, quantity, party, date, notes } = req.body;
    const [result] = await pool.query(
      "INSERT INTO inward (seedName, quantity, party, date, notes) VALUES (?, ?, ?, ?, ?)",
      [seedName, quantity, party, date, notes]
    );
    res.status(201).json({ message: "Inward entry added", id: result.insertId });
  } catch (err) {
    handleDbError(res, err);
  }
});

app.post("/api/outward", async (req, res) => {
  try {
    const { seedName, quantity, party, date, notes } = req.body;
    const [result] = await pool.query(
      "INSERT INTO outward (seedName, quantity, party, date, notes) VALUES (?, ?, ?, ?, ?)",
      [seedName, quantity, party, date, notes]
    );
    res.status(201).json({ message: "Outward entry added", id: result.insertId });
  } catch (err) {
    handleDbError(res, err);
  }
});

// GET
app.get("/api/inward", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM inward ORDER BY createdAt DESC");
    res.json(rows);
  } catch (err) {
    handleDbError(res, err);
  }
});

app.get("/api/outward", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM outward ORDER BY createdAt DESC");
    res.json(rows);
  } catch (err) {
    handleDbError(res, err);
  }
});

// DELETE
app.delete("/api/inward/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query("DELETE FROM inward WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Entry not found" });
    }
    res.json({ message: "Deleted" });
  } catch (err) {
    handleDbError(res, err);
  }
});

// Serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await initializeDatabase();
});
