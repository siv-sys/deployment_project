import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',') 
  : ['http://localhost:5173', 'http://172.16.16.159', 'http://siv.com'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy does not allow access from origin ${origin}`), false);
  },
  credentials: true
}));

app.use(express.json());

// Database connection pool configuration
const dbConfig = {
  host: process.env.DB_HOST || '192.168.108.234',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'siv_user',
  password: process.env.DB_PASSWORD || 'siv_password_2026',
  database: process.env.DB_NAME || 'siv_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 5000 // 5 seconds timeout
};

let pool;

try {
  pool = mysql.createPool(dbConfig);
  console.log(`MySQL connection pool initialized for ${dbConfig.host}:${dbConfig.port}`);
  
  // Test connection in the background so it doesn't block server startup
  pool.getConnection()
    .then(conn => {
      console.log('Successfully connected to MySQL database.');
      conn.release();
    })
    .catch(err => {
      console.error('\x1b[33m%s\x1b[0m', `Warning: Unable to connect to MySQL database at ${dbConfig.host}:${dbConfig.port}.`);
      console.error('\x1b[33m%s\x1b[0m', `Reason: ${err.message}`);
      console.error('\x1b[33m%s\x1b[0m', 'Ensure MySQL server is running, listening on all interfaces (0.0.0.0), and firewall rules allow port 3306.');
    });
} catch (err) {
  console.error('Failed to create MySQL pool:', err);
}

// Middleware to check database connectivity
const checkDbConnection = async (req, res, next) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database connection pool not initialized.' });
  }
  try {
    const conn = await pool.getConnection();
    conn.release();
    next();
  } catch (err) {
    res.status(500).json({ 
      error: 'Database connection failed. Database server might be offline.',
      details: err.message 
    });
  }
};

// --- API ROUTES ---

// Health Check
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  if (pool) {
    try {
      const conn = await pool.getConnection();
      conn.release();
      dbStatus = 'connected';
    } catch (err) {
      dbStatus = `error: ${err.message}`;
    }
  }
  res.json({
    status: 'online',
    timestamp: new Date(),
    database: {
      status: dbStatus,
      host: dbConfig.host
    }
  });
});

// GET all products (with search and category filtering)
app.get('/api/products', checkDbConnection, async (req, res) => {
  try {
    const { q, category } = req.query;
    let queryStr = 'SELECT * FROM products';
    const params = [];
    const conditions = [];

    if (q) {
      conditions.push('(name LIKE ? OR sku LIKE ? OR description LIKE ?)');
      const wildCardQuery = `%${q}%`;
      params.push(wildCardQuery, wildCardQuery, wildCardQuery);
    }

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }

    // Sort by latest added first
    queryStr += ' ORDER BY id DESC';

    const [rows] = await pool.query(queryStr, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// GET product by ID
app.get('/api/products/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: `Product with ID ${id} not found.` });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// POST create product
app.post('/api/products', checkDbConnection, async (req, res) => {
  const { sku, name, description, category, quantity, price } = req.body;

  // Validation
  if (!sku || !name || !category) {
    return res.status(400).json({ error: 'SKU, name, and category are required fields.' });
  }

  const parsedQuantity = parseInt(quantity || '0');
  const parsedPrice = parseFloat(price || '0.00');

  if (isNaN(parsedQuantity) || parsedQuantity < 0) {
    return res.status(400).json({ error: 'Quantity must be a non-negative integer.' });
  }
  if (isNaN(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ error: 'Price must be a non-negative decimal.' });
  }

  try {
    // Check if SKU is unique
    const [existing] = await pool.query('SELECT id FROM products WHERE sku = ?', [sku]);
    if (existing.length > 0) {
      return res.status(400).json({ error: `SKU '${sku}' already exists.` });
    }

    const [result] = await pool.query(
      'INSERT INTO products (sku, name, description, category, quantity, price) VALUES (?, ?, ?, ?, ?, ?)',
      [sku, name, description || '', category, parsedQuantity, parsedPrice]
    );

    const newProductId = result.insertId;
    const [newProduct] = await pool.query('SELECT * FROM products WHERE id = ?', [newProductId]);
    
    res.status(201).json({
      message: 'Product created successfully',
      product: newProduct[0]
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// PUT update product
app.put('/api/products/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  const { sku, name, description, category, quantity, price } = req.body;

  // Validation
  if (!sku || !name || !category) {
    return res.status(400).json({ error: 'SKU, name, and category are required fields.' });
  }

  const parsedQuantity = parseInt(quantity);
  const parsedPrice = parseFloat(price);

  if (isNaN(parsedQuantity) || parsedQuantity < 0) {
    return res.status(400).json({ error: 'Quantity must be a non-negative integer.' });
  }
  if (isNaN(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ error: 'Price must be a non-negative decimal.' });
  }

  try {
    // Verify product exists
    const [existingProduct] = await pool.query('SELECT id FROM products WHERE id = ?', [id]);
    if (existingProduct.length === 0) {
      return res.status(404).json({ error: `Product with ID ${id} not found.` });
    }

    // Verify SKU unique (excluding current product)
    const [existingSku] = await pool.query('SELECT id FROM products WHERE sku = ? AND id != ?', [sku, id]);
    if (existingSku.length > 0) {
      return res.status(400).json({ error: `SKU '${sku}' is already in use by another product.` });
    }

    await pool.query(
      'UPDATE products SET sku = ?, name = ?, description = ?, category = ?, quantity = ?, price = ? WHERE id = ?',
      [sku, name, description || '', category, parsedQuantity, parsedPrice, id]
    );

    const [updatedProduct] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);

    res.json({
      message: 'Product updated successfully',
      product: updatedProduct[0]
    });
  } catch (error) {
    console.error(`Error updating product ${id}:`, error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// DELETE product
app.delete('/api/products/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  try {
    const [existing] = await pool.query('SELECT id FROM products WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: `Product with ID ${id} not found.` });
    }

    await pool.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: `Product with ID ${id} deleted successfully.` });
  } catch (error) {
    console.error(`Error deleting product ${id}:`, error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);
  res.status(500).json({ error: 'An unexpected server error occurred.', details: err.message });
});

// Start Server
app.listen(PORT, () => {
  console.log(`--------------------------------------------------`);
  console.log(`Server is running in ${process.env.NODE_ENV} mode`);
  console.log(`Port: ${PORT}`);
  console.log(`API URL: http://localhost:${PORT}/api/products`);
  console.log(`--------------------------------------------------`);
});
// Trigger nodemon configuration reload
