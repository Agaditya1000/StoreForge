const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { installStore, deleteStore, listStores, setupWooCommerce } = require('./helm');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());

// Verify chart path exists on startup
const CHART_PATH = path.resolve(__dirname, '../../charts/universal-store');
if (!fs.existsSync(CHART_PATH)) {
    console.error(`CRITICAL: Chart path not found at ${CHART_PATH}`);
} else {
    console.log(`Chart path verified: ${CHART_PATH}`);
}

// Track in-progress provisioning for async status
const provisioningStores = new Map();

// ─── List Stores ───
app.get('/api/stores', async (req, res) => {
    try {
        const stores = await listStores();

        // Merge with any in-progress provisioning
        const result = [...stores];
        for (const [name, info] of provisioningStores) {
            if (!stores.find(s => s.name === name)) {
                result.push(info);
            } else {
                // Store appeared in Helm list — remove from tracking
                provisioningStores.delete(name);
            }
        }

        res.json(result);
    } catch (err) {
        console.error('GET /api/stores error:', err);
        res.status(500).json({ error: 'Failed to list stores' });
    }
});

// ─── Create Store ───
app.post('/api/stores', async (req, res) => {
    const { name, engine } = req.body;
    if (!name || !engine) {
        return res.status(400).json({ error: 'Name and engine are required' });
    }

    // Validate name: kebab-case, 3+ chars
    const sanitized = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (sanitized.length < 3) {
        return res.status(400).json({ error: 'Store name must be at least 3 characters (letters, numbers, hyphens)' });
    }
    if (name !== sanitized) {
        return res.status(400).json({ error: `Invalid name. Suggested: ${sanitized}` });
    }

    if (!['woocommerce'].includes(engine)) {
        return res.status(400).json({ error: 'Invalid engine. Supported: woocommerce' });
    }

    // Check for duplicate
    const existing = await listStores();
    if (existing.find(s => s.name === name) || provisioningStores.has(name)) {
        return res.status(409).json({ error: `Store "${name}" already exists` });
    }

    console.log(`[CREATE] Provisioning store: ${name} (${engine})`);

    // Add to provisioning tracker immediately
    provisioningStores.set(name, {
        name,
        namespace: name,
        status: 'Provisioning',
        helmStatus: 'pending-install',
        url: `http://${name}.local`,
        adminUrl: `http://${name}.local/wp-admin`,
        engine,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        chart: 'universal-store-0.2.0'
    });

    // Respond immediately — provisioning happens asynchronously
    res.status(202).json({
        status: 'Provisioning',
        message: `Store "${name}" is being provisioned. This may take several minutes.`,
        name
    });

    // Run Helm install in background
    installStore(name, engine).then(async result => {
        if (result.success) {
            console.log(`[CREATE] Store "${name}" Helm deployed. Starting WooCommerce setup...`);
            // Auto-setup WooCommerce (installs plugin, theme, COD, sample product)
            const wooResult = await setupWooCommerce(name);
            if (wooResult.success) {
                console.log(`[CREATE] Store "${name}" fully provisioned with WooCommerce`);
            } else {
                console.warn(`[CREATE] Store "${name}" deployed but WooCommerce setup had issues:`, wooResult.error);
            }
            provisioningStores.delete(name);
        } else {
            console.error(`[CREATE] Store "${name}" failed:`, result.error);
            provisioningStores.set(name, {
                ...provisioningStores.get(name),
                status: 'Failed',
                helmStatus: 'failed',
                error: result.error
            });
        }
    });
});

// ─── Delete Store ───
app.delete('/api/stores/:name', async (req, res) => {
    const { name } = req.params;
    console.log(`[DELETE] Deleting store: ${name}`);

    const result = await deleteStore(name);
    provisioningStores.delete(name); // Clean from tracker too

    if (result.success) {
        res.json({ status: 'deleted', message: `Store "${name}" and all resources removed` });
    } else {
        res.status(500).json({ error: result.error });
    }
});

// ─── Health check ───
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`StoreForge backend listening on port ${PORT}`);
});
