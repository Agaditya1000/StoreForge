const express = require('express');
const cors = require('cors');
const { installStore, deleteStore, listStores } = require('./helm');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Ensure the backend can find necessary paths
const CHART_PATH = path.resolve(__dirname, '../../charts/universal-store');
if (!fs.existsSync(CHART_PATH)) {
    console.error(`CRITICAL: Chart path not found at ${CHART_PATH}`);
}

app.get('/api/stores', async (req, res) => {
    const stores = await listStores();
    // Filter to show only our stores (heuristic: name starts with "store-" or assuming all helm releases are relevant)
    res.json(stores);
});

app.post('/api/stores', async (req, res) => {
    const { name, engine } = req.body;
    if (!name || !engine) {
        return res.status(400).json({ error: 'Name and engine required' });
    }

    // Sanitize and validate name (kebab-case only, no spaces)
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    if (sanitizedName.length < 3) {
        return res.status(400).json({ error: 'Store name must be at least 3 characters (letters, numbers, hyphens)' });
    }

    if (name !== sanitizedName) {
        return res.status(400).json({ error: `Invalid name. Suggested: ${sanitizedName}` });
    }

    // Basic validation
    if (!['woocommerce', 'medusa'].includes(engine)) {
        return res.status(400).json({ error: 'Invalid engine' });
    }

    console.log(`Provisioning store: ${name} (${engine})`);
    const result = await installStore(name, engine);

    if (result.success) {
        res.json({ status: 'provisioning', message: 'Store provisioning started', details: result.output });
    } else {
        res.status(500).json({ status: 'failed', error: result.error });
    }
});

app.delete('/api/stores/:name', async (req, res) => {
    const { name } = req.params;
    console.log(`Deleting store: ${name}`);
    const result = await deleteStore(name);
    if (result.success) {
        res.json({ status: 'deleted' });
    } else {
        res.status(500).json({ error: result.error });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
});
