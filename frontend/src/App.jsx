import { useState, useEffect } from 'react';
import './index.css';

const API_URL = 'http://localhost:3001/api';

function App() {
  const [stores, setStores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStores = async () => {
    try {
      const res = await fetch(`${API_URL}/stores`);
      if (!res.ok) throw new Error('Failed to fetch stores');
      const data = await res.json();
      setStores(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not connect to backend. Is it running?');
    }
  };

  useEffect(() => {
    fetchStores();
    const interval = setInterval(fetchStores, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateStore = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const storeData = {
      name: formData.get('name'),
      engine: formData.get('engine')
    };

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeData)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create');
      }

      await fetchStores();
      setIsModalOpen(false);
      e.target.reset();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (name) => {
    if (!confirm(`Are you sure you want to delete "${name}"? All resources will be permanently removed.`)) return;

    try {
      const res = await fetch(`${API_URL}/stores/${name}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchStores();
    } catch (err) {
      alert(err.message);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Ready': return 'status-ready';
      case 'Failed': return 'status-failed';
      default: return 'status-provisioning';
    }
  };

  const storeCount = stores.length;
  const readyCount = stores.filter(s => s.status === 'Ready').length;
  const provisioningCount = stores.filter(s => s.status === 'Provisioning').length;

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">⚡</span> StoreForge
          </div>
          <div className="stats-bar">
            <span className="stat">
              <span className="stat-value">{storeCount}</span> Total
            </span>
            <span className="stat-divider">|</span>
            <span className="stat stat-ready">
              <span className="stat-dot dot-ready"></span>
              <span className="stat-value">{readyCount}</span> Ready
            </span>
            {provisioningCount > 0 && (
              <>
                <span className="stat-divider">|</span>
                <span className="stat stat-prov">
                  <span className="stat-dot dot-prov"></span>
                  <span className="stat-value">{provisioningCount}</span> Provisioning
                </span>
              </>
            )}
          </div>
        </div>
        <button className="btn" onClick={() => setIsModalOpen(true)}>
          + New Store
        </button>
      </header>

      {error && (
        <div className="error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="grid">
        {stores.map((store) => (
          <div key={store.name} className="glass-panel store-card">
            <div className="card-header">
              <div>
                <h3 className="store-name">{store.name}</h3>
                <p className="store-engine">
                  Engine: <strong>{store.engine || 'woocommerce'}</strong>
                </p>
              </div>
              <span className={`status-badge ${getStatusClass(store.status)}`}>
                {store.status === 'Provisioning' && <span className="spinner"></span>}
                {store.status}
              </span>
            </div>

            <div className="store-urls">
              <div className="url-row">
                <span className="url-label">Store</span>
                <a href={store.url} target="_blank" rel="noreferrer" className="url-link">
                  {store.url} ↗
                </a>
              </div>
              <div className="url-row">
                <span className="url-label">Admin</span>
                <a href={store.adminUrl} target="_blank" rel="noreferrer" className="url-link">
                  {store.adminUrl} ↗
                </a>
              </div>
            </div>

            {store.status === 'Ready' && (
              <div className="store-creds">
                <span className="creds-label">Admin Login:</span>
                <code>admin / admin123</code>
              </div>
            )}

            <div className="card-footer">
              <div className="store-timestamp">
                Created: {new Date(store.created).toLocaleString()}
              </div>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDelete(store.name)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {stores.length === 0 && !error && (
          <div className="glass-panel empty-state">
            <div className="empty-icon">🏪</div>
            <h3>No stores yet</h3>
            <p>Click "+ New Store" to provision your first WooCommerce instance.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="glass-panel modal">
            <h2 className="modal-title">Deploy New Store</h2>
            <p className="modal-subtitle">Provisions a full WooCommerce instance with database and ingress.</p>
            <form onSubmit={handleCreateStore}>
              <div className="form-group">
                <label className="form-label">Store Name</label>
                <input
                  name="name"
                  className="input-field"
                  placeholder="my-awesome-shop"
                  pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
                  title="Lowercase letters, numbers, and hyphens. Must start/end with alphanumeric."
                  minLength={3}
                  required
                  autoFocus
                />
                <small className="form-hint">
                  Store URL: <code>http://[name].local</code> &nbsp;|&nbsp; Min 3 characters, kebab-case
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Engine</label>
                <div className="engine-option active">
                  <input type="radio" name="engine" value="woocommerce" defaultChecked />
                  <div>
                    <strong>WooCommerce</strong>
                    <small>WordPress + WooCommerce</small>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={isLoading}>
                  {isLoading ? '⏳ Creating...' : '🚀 Create Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
