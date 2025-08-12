require('dotenv').config();
const express = require("express");
const { Pool } = require('pg');
const path = require("path");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
      }
);


;
// Database Initialization
async function initializeDatabase() {
  try {
    const queries = [
      `CREATE TABLE IF NOT EXISTS inward (
        id SERIAL PRIMARY KEY,
        seedName VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        party VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS outward (
        id SERIAL PRIMARY KEY,
        seedName VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        party VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS returns (
        id SERIAL PRIMARY KEY,
        seedName VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        notes TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS expiry (
        id SERIAL PRIMARY KEY,
        seedName VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        expiryDate DATE NOT NULL,
        action VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    // Execute each query sequentially
    const client = await pool.connect();
    try {
      for (const query of queries) {
        await client.query(query);
      }
      console.log("✅ Database tables initialized");
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("❌ Database initialization failed:", err);
    process.exit(1);
  }
}

// Helper function for error handling
const handleDbError = (res, err) => {
  console.error("Database error:", err);
  res.status(500).json({ error: "Database operation failed", details: err.message });
};

// API Endpoints

// Create operations
app.post("/api/inward", async (req, res) => {
  try {
    const { seedName, quantity, party, date, notes } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO inward (seedName, quantity, party, date, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [seedName, quantity, party, date, notes]
    );
    res.status(201).json({ message: "Inward entry added", data: rows[0] });
  } catch (err) {
    handleDbError(res, err);
  }
});

app.post("/api/outward", async (req, res) => {
  try {
    const { seedName, quantity, party, date, notes } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO outward (seedName, quantity, party, date, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [seedName, quantity, party, date, notes]
    );
    res.status(201).json({ message: "Outward entry added", data: rows[0] });
  } catch (err) {
    handleDbError(res, err);
  }
});

app.post("/api/returns", async (req, res) => {
  try {
    const { seedName, quantity, reason, date, notes } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO returns (seedName, quantity, reason, date, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [seedName, quantity, reason, date, notes]
    );
    res.status(201).json({ message: "Return entry added", data: rows[0] });
  } catch (err) {
    handleDbError(res, err);
  }
});

app.post("/api/expiry", async (req, res) => {
  try {
    const { seedName, quantity, expiryDate, action } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO expiry (seedName, quantity, expiryDate, action) VALUES ($1, $2, $3, $4) RETURNING *",
      [seedName, quantity, expiryDate, action]
    );
    res.status(201).json({ message: "Expiry entry added", data: rows[0] });
  } catch (err) {
    handleDbError(res, err);
  }
});

// Read operations with pagination example
app.get("/api/inward", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const { rows } = await pool.query(
      "SELECT * FROM inward ORDER BY createdAt DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );
    const { rows: [{ count }] } = await pool.query("SELECT COUNT(*) FROM inward");
    res.json({
      data: rows,
      pagination: {
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    handleDbError(res, err);
  }
});

// Similar pagination can be added to other GET endpoints
app.get("/api/outward", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM outward ORDER BY createdAt DESC");
    res.json(rows);
  } catch (err) {
    handleDbError(res, err);
  }
});

app.get("/api/returns", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM returns ORDER BY createdAt DESC");
    res.json(rows);
  } catch (err) {
    handleDbError(res, err);
  }
});

app.get("/api/expiry", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM expiry ORDER BY createdAt DESC");
    res.json(rows);
  } catch (err) {
    handleDbError(res, err);
  }
});

// Delete operations
app.delete("/api/inward/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query("DELETE FROM inward WHERE id = $1", [id]);
    if (rowCount === 0) {
      return res.status(404).json({ message: "Entry not found" });
    }
    res.json({ message: "Inward entry deleted" });
  } catch (err) {
    handleDbError(res, err);
  }
});

app.delete("/api/outward/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query("DELETE FROM outward WHERE id = $1", [id]);
    if (rowCount === 0) {
      return res.status(404).json({ message: "Entry not found" });
    }
    res.json({ message: "Outward entry deleted" });
  } catch (err) {
    handleDbError(res, err);
  }
});

app.delete("/api/returns/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query("DELETE FROM returns WHERE id = $1", [id]);
    if (rowCount === 0) {
      return res.status(404).json({ message: "Entry not found" });
    }
    res.json({ message: "Return entry deleted" });
  } catch (err) {
    handleDbError(res, err);
  }
});

app.delete("/api/expiry/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query("DELETE FROM expiry WHERE id = $1", [id]);
    if (rowCount === 0) {
      return res.status(404).json({ message: "Entry not found" });
    }
    res.json({ message: "Expiry entry deleted" });
  } catch (err) {
    handleDbError(res, err);
  }
});

// Reports endpoint with error handling
app.get("/api/reports", async (req, res) => {
  try {
    const [inwardResult, outwardResult, returnResult, expiryResult] = await Promise.all([
      pool.query("SELECT * FROM inward"),
      pool.query("SELECT * FROM outward"),
      pool.query("SELECT * FROM returns"),
      pool.query("SELECT * FROM expiry")
    ]);
    
    res.json({
      inwardData: inwardResult.rows,
      outwardData: outwardResult.rows,
      returnData: returnResult.rows,
      expiryData: expiryResult.rows
    });
  } catch (err) {
    handleDbError(res, err);
  }
});

// Serve the frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await initializeDatabase();
});