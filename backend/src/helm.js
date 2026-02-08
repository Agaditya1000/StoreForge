const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const path = require('path');

const CHART_PATH = path.resolve(__dirname, '../../charts/universal-store');

const fs = require('fs');
// Hardcoded path found via Winget
const HELM_PATH_WINGET = 'C:\\Users\\agadi\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Helm.Helm_Microsoft.Winget.Source_8wekyb3d8bbwe\\windows-amd64\\helm.exe';

// Force usage of absolute path, fallback to 'helm' only if strictly necessary
const HELM_CMD = `"${HELM_PATH_WINGET}"`;
console.log(`Using Helm Path: ${HELM_CMD}`);

async function installStore(storeName, engine) {
  try {
    const namespace = storeName;
    const command = `${HELM_CMD} upgrade --install ${storeName} "${CHART_PATH}" --namespace ${namespace} --create-namespace --set store.name=${storeName} --set store.engine=${engine} --set ingress.host=${storeName}.local`;
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
    const command = `${HELM_CMD} uninstall ${storeName} --namespace ${storeName}`;
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
  try {
    // Get Helm releases
    const { stdout: helmOutput } = await execAsync(`${HELM_CMD} list --all-namespaces -o json`);
    const releases = JSON.parse(helmOutput);

    // Get Services to find engine labels
    // We use the patched helm.js command logic but for kubectl, we need standard kubectl in path
    const { stdout: kubectlOutput } = await execAsync('kubectl get services --all-namespaces -l tier=frontend -o json');
    const services = JSON.parse(kubectlOutput).items || [];

    // Map service name to engine
    const engineMap = {};
    services.forEach(svc => {
      // svc.metadata.name should match store name
      const name = svc.metadata.name;
      const engine = svc.metadata.labels['store.engine'];
      if (engine) engineMap[name] = engine;
    });

    return releases.map(release => {
      // Fix Date: "2026-02-07 01:14:23.7547941 +0530 IST" -> "2026-02-07 01:14:23"
      // Regex to take the first part YYYY-MM-DD HH:mm:ss
      let cleanDate = release.updated;
      const dateMatch = release.updated.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
      if (dateMatch) {
        cleanDate = dateMatch[1].replace(' ', 'T'); // ISO format
      }

      return {
        ...release,
        updated: cleanDate,
        Labels: {
          'store.engine': engineMap[release.name] || 'Unknown'
        }
      };
    });
  } catch (error) {
    console.error('List stores failed:', error);
    return [];
  }
}

module.exports = { installStore, deleteStore, listStores };
