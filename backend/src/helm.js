const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const path = require('path');

const CHART_PATH = path.resolve(__dirname, '../../charts/universal-store');

async function installStore(storeName, engine) {
  try {
    const namespace = storeName;
    const command = `helm upgrade --install ${storeName} "${CHART_PATH}" --namespace ${namespace} --create-namespace --set store.name=${storeName} --set store.engine=${engine} --set ingress.host=${storeName}.local`;
    console.log(`Executing: ${command}`);
    const { stdout, stderr } = await execAsync(command);
    return { success: true, output: stdout, error: stderr };
  } catch (error) {
    console.error('Helm install failed:', error);
    return { success: false, error: error.message };
  }
}

async function deleteStore(storeName) {
  try {
    const command = `helm uninstall ${storeName} --namespace ${storeName}`;
    const commandNs = `kubectl delete namespace ${storeName}`;
    
    await execAsync(command);
    await execAsync(commandNs); // Cleanup namespace
    
    return { success: true };
  } catch (error) {
    console.error('Helm delete failed:', error);
    return { success: false, error: error.message };
  }
}

async function listStores() {
    // This is a bit tricky with pure Helm if we want status across namespaces.
    // For now, simpler to just list namespaces or rely on a local DB.
    // But let's try to find our releases.
    // "helm list --all-namespaces"
    try {
        const { stdout } = await execAsync('helm list --all-namespaces -o json');
        return JSON.parse(stdout);
    } catch (error) {
        return [];
    }
}

module.exports = { installStore, deleteStore, listStores };
