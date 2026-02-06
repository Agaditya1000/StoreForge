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
    const interval = setInterval(fetchStores, 5000); // Polling for status updates
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
      e.target.reset(); // Reset form
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (name) => {
    if (!confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${API_URL}/stores/${name}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchStores();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">StoreForge</div>
        <button className="btn" onClick={() => setIsModalOpen(true)}>
          + New Store
        </button>
      </header>

      {error && (
        <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '1rem', border: '1px solid var(--danger)', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      <div className="grid">
        {stores.map((store) => (
          <div key={store.name} className="glass-panel store-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>{store.name}</h3>
                <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Engine: <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{store.Labels?.['store.engine'] || 'Unknown'}</strong>
                </p>
              </div>
              <span className={`status-badge ${store.status === 'deployed' ? 'status-ready' : 'status-provisioning'}`}>
                {store.status}
              </span>
            </div>

            <div style={{ marginTop: '2rem' }}>
              {store.status === 'deployed' && (
                <a
                  href={`http://${store.name}.local`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ display: 'block', textAlign: 'center', marginBottom: '1rem', textDecoration: 'none' }}
                >
                  Open Dashboard ↗
                </a>
              )}
              <button
                className="btn btn-danger"
                style={{ width: '100%' }}
                onClick={() => handleDelete(store.name)}
              >
                Delete Store
              </button>
            </div>

            <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Updated: {new Date(store.updated).toLocaleString()}
            </div>
          </div>
        ))}

        {stores.length === 0 && !error && (
          <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <h3>No stores yet</h3>
            <p>Click "New Store" to provision your first e-commerce instance.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="glass-panel modal">
            <h2 style={{ marginTop: 0 }}>Deploy New Store</h2>
            <form onSubmit={handleCreateStore}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Store Name</label>
                <input
                  name="name"
                  className="input-field"
                  placeholder="my-awesome-shop"
                  pattern="[a-z0-9-]+"
                  title="Lowercase letters, numbers, and hyphens only"
                  required
                  autoFocus
                />
                <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                  Used for URL: http://[name].local
                </small>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Engine</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="radio" name="engine" value="woocommerce" defaultChecked style={{ marginRight: '0.5rem' }} />
                    WooCommerce
                  </label>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="radio" name="engine" value="medusa" style={{ marginRight: '0.5rem' }} />
                    MedusaJS
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn" style={{ flex: 1 }} disabled={isLoading}>
                  {isLoading ? ' provisioning...' : 'Create Store'}
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
