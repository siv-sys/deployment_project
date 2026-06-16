import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  X, 
  Package, 
  DollarSign, 
  AlertTriangle, 
  Check, 
  Info,
  TrendingUp,
  Server,
  RefreshCw,
  FolderOpen
} from 'lucide-react';

// Dynamic API URL: Fallbacks to production server IP (172.16.16.69) if not local
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'http://172.16.16.69:5000/api');

const CATEGORIES = ['Electronics', 'Audio', 'Furniture', 'Peripherals', 'Wearables', 'Lifestyle'];

function App() {
  // Application State
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Modals Visibility
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Current active product for update/delete
  const [activeProduct, setActiveProduct] = useState(null);
  
  // Notification Toast State
  const [toasts, setToasts] = useState([]);

  // Form State
  const [formValues, setFormValues] = useState({
    sku: '',
    name: '',
    description: '',
    category: 'Electronics',
    quantity: 0,
    price: 0.00
  });

  // Load Products
  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_BASE_URL}/products`;
      const params = [];
      if (searchQuery) params.push(`q=${encodeURIComponent(searchQuery)}`);
      if (selectedCategory) params.push(`category=${encodeURIComponent(selectedCategory)}`);
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }
      const data = await response.json();
      setProducts(data);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to connect to the backend server API.');
      showToast(err.message || 'Connection to API failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search/filter query changes
    const delayDebounceFn = setTimeout(() => {
      fetchProducts();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, selectedCategory]);

  // Handle Toast Trigger
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto remove after 3.5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  // Input Handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: name === 'quantity' ? parseInt(value) || 0 : name === 'price' ? parseFloat(value) || 0.00 : value
    }));
  };

  // Create Product Submit Handler
  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to add product');
      }

      showToast(`Product "${result.product.name}" added successfully.`, 'success');
      setShowAddModal(false);
      resetForm();
      fetchProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Update Product Submit Handler
  const handleEditProduct = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/products/${activeProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update product');
      }

      showToast(`Product "${result.product.name}" updated successfully.`, 'success');
      setShowEditModal(false);
      setActiveProduct(null);
      resetForm();
      fetchProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Delete Product Handler
  const handleDeleteProduct = async () => {
    if (!activeProduct) return;
    try {
      const response = await fetch(`${API_BASE_URL}/products/${activeProduct.id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete product');
      }

      showToast(`Product has been deleted successfully.`, 'success');
      setShowDeleteConfirm(false);
      setActiveProduct(null);
      fetchProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Form Reset
  const resetForm = () => {
    setFormValues({
      sku: '',
      name: '',
      description: '',
      category: 'Electronics',
      quantity: 0,
      price: 0.00
    });
  };

  // Open Edit Modal & Hydrate Form
  const openEditModal = (product) => {
    setActiveProduct(product);
    setFormValues({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      category: product.category,
      quantity: product.quantity,
      price: parseFloat(product.price)
    });
    setShowEditModal(true);
  };

  // Open Delete Modal
  const openDeleteModal = (product) => {
    setActiveProduct(product);
    setShowDeleteConfirm(true);
  };

  // Calculate Dashboard Summary Metrics
  const totalItems = products.length;
  const totalValue = products.reduce((acc, p) => acc + (p.price * p.quantity), 0);
  const outOfStockCount = products.filter(p => p.quantity === 0).length;
  const avgPrice = totalItems > 0 ? (products.reduce((acc, p) => acc + parseFloat(p.price), 0) / totalItems) : 0;

  return (
    <div className="app-container">
      {/* 1. Header Section */}
      <header className="app-header">
        <div className="logo-group">
          <Package className="logo-icon" size={32} />
          <div>
            <h1 className="app-title" id="main-heading">SIV Inventory</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Enterprise CRUD System &bull; siv.com</p>
          </div>
        </div>
        
        <div className="logo-group" style={{ gap: '0.5rem' }}>
          <div className="server-badge" title="Database IP: 192.168.108.234">
            <span className="server-dot"></span>
            DB: 192.168.108.234
          </div>
          <div className="server-badge" title="Backend Server IP: 172.16.16.69">
            <span className="server-dot"></span>
            API: 172.16.16.69
          </div>
          <button 
            id="btn-refresh" 
            className="btn btn-secondary btn-icon-only" 
            onClick={fetchProducts} 
            title="Refresh database records"
          >
            <RefreshCw size={16} className={loading ? "spinner" : ""} />
          </button>
        </div>
      </header>

      {/* 2. Metrics Grid */}
      <section className="metrics-grid" aria-label="Inventory Metrics Summary">
        <div className="metric-card" id="metric-total-items">
          <div className="metric-info">
            <h3>Total Products</h3>
            <div className="metric-value">{totalItems}</div>
          </div>
          <div className="metric-icon-wrapper primary">
            <Package size={24} />
          </div>
        </div>

        <div className="metric-card" id="metric-stock-value">
          <div className="metric-info">
            <h3>Inventory Value</h3>
            <div className="metric-value">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div className="metric-icon-wrapper success">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="metric-card" id="metric-out-of-stock">
          <div className="metric-info">
            <h3>Out of Stock</h3>
            <div className="metric-value" style={{ color: outOfStockCount > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
              {outOfStockCount}
            </div>
          </div>
          <div className="metric-icon-wrapper danger">
            <AlertTriangle size={24} />
          </div>
        </div>

        <div className="metric-card" id="metric-avg-price">
          <div className="metric-info">
            <h3>Average Price</h3>
            <div className="metric-value">${avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div className="metric-icon-wrapper warning">
            <TrendingUp size={24} />
          </div>
        </div>
      </section>

      {/* 3. API Error Alerts */}
      {error && (
        <div className="error-container" id="api-error-alert" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={20} />
            <div>
              <strong>API Connectivity Error:</strong> {error}
            </div>
          </div>
          <button className="btn btn-secondary btn-icon-only" style={{ border: 'none' }} onClick={() => setError(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* 4. Controls Panel (Search, Filter, Create Trigger) */}
      <section className="controls-panel" aria-label="Search and Filter Controls">
        <div className="search-filter-group">
          <div className="search-input-wrapper">
            <Search className="search-icon" size={18} />
            <input
              id="search-input"
              type="text"
              className="input-search"
              placeholder="Search products by Name, SKU or Description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <select
            id="category-filter"
            className="select-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <button 
          id="btn-add-product" 
          className="btn btn-primary" 
          onClick={() => { resetForm(); setShowAddModal(true); }}
        >
          <Plus size={18} />
          Add Product
        </button>
      </section>

      {/* 5. Main Data Table */}
      <main className="table-container">
        {loading && products.length === 0 ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading database records...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <FolderOpen size={48} className="empty-state-icon" />
            <h3>No products found</h3>
            <p>Try clearing your search query, selecting another category, or add a new inventory item.</p>
            {(searchQuery || selectedCategory) && (
              <button 
                id="btn-clear-filters" 
                className="btn btn-secondary" 
                style={{ marginTop: '1rem' }}
                onClick={() => { setSearchQuery(''); setSelectedCategory(''); }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <table className="custom-table" id="products-table">
            <thead>
              <tr>
                <th style={{ width: '15%' }}>SKU</th>
                <th style={{ width: '25%' }}>Product Name</th>
                <th style={{ width: '15%' }}>Category</th>
                <th style={{ width: '12%' }}>Stock Status</th>
                <th style={{ width: '13%', textAlign: 'right' }}>Unit Price</th>
                <th style={{ width: '13%', textAlign: 'right' }}>Stock Value</th>
                <th style={{ width: '7%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const stockVal = product.price * product.quantity;
                let stockClass = "in-stock";
                let stockText = `${product.quantity} units`;
                if (product.quantity === 0) {
                  stockClass = "out-of-stock";
                  stockText = "Out of Stock";
                } else if (product.quantity < 10) {
                  stockClass = "low-stock";
                  stockText = `${product.quantity} Low`;
                }

                return (
                  <tr key={product.id} id={`product-row-${product.id}`}>
                    <td>
                      <span className="sku-tag" id={`sku-tag-${product.id}`}>{product.sku}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{product.name}</div>
                      {product.description && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '250px' }} title={product.description}>
                          {product.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="category-tag">{product.category}</span>
                    </td>
                    <td>
                      <span className={`stock-indicator ${stockClass}`}>
                        <span className="indicator-dot"></span>
                        {stockText}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '500' }}>
                      ${parseFloat(product.price).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      ${stockVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="actions-cell">
                        <button
                          id={`btn-edit-${product.id}`}
                          className="btn btn-secondary btn-icon-only"
                          onClick={() => openEditModal(product)}
                          title="Edit product"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          id={`btn-delete-${product.id}`}
                          className="btn btn-danger btn-icon-only"
                          onClick={() => openDeleteModal(product)}
                          title="Delete product"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </main>

      {/* 6. Modals (Add, Edit, Delete Confirm) */}
      
      {/* ADD MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Product</h2>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddProduct}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="add-sku">Product SKU *</label>
                    <input
                      id="add-sku"
                      name="sku"
                      type="text"
                      required
                      placeholder="e.g. SKU-10293"
                      className="form-control"
                      value={formValues.sku}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="add-category">Category *</label>
                    <select
                      id="add-category"
                      name="category"
                      className="form-control"
                      value={formValues.category}
                      onChange={handleInputChange}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group full-width">
                    <label htmlFor="add-name">Product Name *</label>
                    <input
                      id="add-name"
                      name="name"
                      type="text"
                      required
                      placeholder="Enter product title"
                      className="form-control"
                      value={formValues.name}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="add-quantity">Stock Quantity</label>
                    <input
                      id="add-quantity"
                      name="quantity"
                      type="number"
                      min="0"
                      className="form-control"
                      value={formValues.quantity}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="add-price">Price ($) *</label>
                    <input
                      id="add-price"
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      placeholder="0.00"
                      className="form-control"
                      value={formValues.price}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label htmlFor="add-description">Description</label>
                    <textarea
                      id="add-description"
                      name="description"
                      placeholder="Describe the product details..."
                      className="form-control"
                      value={formValues.description}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  id="btn-add-cancel" 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button id="btn-add-submit" type="submit" className="btn btn-primary">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Product: {activeProduct?.sku}</h2>
              <button className="modal-close-btn" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEditProduct}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="edit-sku">Product SKU *</label>
                    <input
                      id="edit-sku"
                      name="sku"
                      type="text"
                      required
                      className="form-control"
                      value={formValues.sku}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="edit-category">Category *</label>
                    <select
                      id="edit-category"
                      name="category"
                      className="form-control"
                      value={formValues.category}
                      onChange={handleInputChange}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group full-width">
                    <label htmlFor="edit-name">Product Name *</label>
                    <input
                      id="edit-name"
                      name="name"
                      type="text"
                      required
                      className="form-control"
                      value={formValues.name}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-quantity">Stock Quantity</label>
                    <input
                      id="edit-quantity"
                      name="quantity"
                      type="number"
                      min="0"
                      className="form-control"
                      value={formValues.quantity}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-price">Price ($) *</label>
                    <input
                      id="edit-price"
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      className="form-control"
                      value={formValues.price}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label htmlFor="edit-description">Description</label>
                    <textarea
                      id="edit-description"
                      name="description"
                      className="form-control"
                      value={formValues.description}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  id="btn-edit-cancel" 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button id="btn-edit-submit" type="submit" className="btn btn-primary">
                  Update Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: 'none' }}>
              <h2>Confirm Deletion</h2>
              <button className="modal-close-btn" onClick={() => setShowDeleteConfirm(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body" style={{ padding: '0 1.5rem 1.5rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Are you sure you want to permanently delete product <strong>{activeProduct?.name}</strong> ({activeProduct?.sku})?
              </p>
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.5rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <AlertTriangle size={14} /> This action is irreversible.
              </p>
            </div>
            
            <div className="modal-footer" style={{ borderTop: 'none' }}>
              <button 
                id="btn-delete-cancel" 
                className="btn btn-secondary" 
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button 
                id="btn-delete-confirm" 
                className="btn btn-danger" 
                onClick={handleDeleteProduct}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Mount */}
      <div className="toast-container" id="toast-wrapper">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`} role="alert">
            {toast.type === 'success' && <Check size={16} style={{ color: 'var(--secondary)' }} />}
            {toast.type === 'error' && <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />}
            {toast.type === 'info' && <Info size={16} style={{ color: 'var(--primary)' }} />}
            <span className="toast-message">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
