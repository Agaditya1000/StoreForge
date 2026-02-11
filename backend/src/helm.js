const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const path = require('path');
const fs = require('fs');

const CHART_PATH = path.resolve(__dirname, '../../charts/universal-store');

// Resolve Helm binary — prefer system PATH, fall back to known Winget location
function resolveHelmPath() {
  const wingetPath = path.join(
    process.env.LOCALAPPDATA || '',
    'Microsoft', 'WinGet', 'Packages',
    'Helm.Helm_Microsoft.Winget.Source_8wekyb3d8bbwe',
    'windows-amd64', 'helm.exe'
  );
  if (fs.existsSync(wingetPath)) return `"${wingetPath}"`;
  return 'helm'; // fall back to PATH
}

const HELM_CMD = resolveHelmPath();
console.log(`Using Helm: ${HELM_CMD}`);

async function installStore(storeName, engine) {
  try {
    const namespace = storeName;
    const command = [
      HELM_CMD, 'upgrade', '--install', storeName,
      `"${CHART_PATH}"`,
      '--namespace', namespace,
      '--create-namespace',
      '--set', `store.name=${storeName}`,
      '--set', `store.engine=${engine}`,
      '--set', `ingress.host=${storeName}.local`
    ].join(' ');

    console.log(`Executing: ${command}`);
    const { stdout, stderr } = await execAsync(command, { timeout: 660000 });
    return { success: true, output: stdout, error: stderr };
  } catch (error) {
    console.error('Helm install failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function deleteStore(storeName) {
  try {
    // Uninstall Helm release
    const helmCmd = `${HELM_CMD} uninstall ${storeName} --namespace ${storeName}`;
    await execAsync(helmCmd);

    // Delete namespace (cleans up all remaining resources: PVCs, Secrets, etc.)
    const nsCmd = `kubectl delete namespace ${storeName} --ignore-not-found`;
    await execAsync(nsCmd);

    return { success: true };
  } catch (error) {
    console.error('Helm delete failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function listStores() {
  try {
    const { stdout: helmOutput } = await execAsync(`${HELM_CMD} list --all-namespaces -o json`);
    const releases = JSON.parse(helmOutput || '[]');

    // Filter to only universal-store chart releases
    const storeReleases = releases.filter(r => r.chart && r.chart.startsWith('universal-store'));

    return storeReleases.map(release => {
      // Normalize date format
      let cleanDate = release.updated;
      const dateMatch = release.updated.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
      if (dateMatch) {
        cleanDate = dateMatch[1].replace(' ', 'T');
      }

      // Map Helm status to user-visible status
      let displayStatus = 'Provisioning';
      if (release.status === 'deployed') displayStatus = 'Ready';
      else if (release.status === 'failed') displayStatus = 'Failed';
      else if (release.status === 'pending-install' || release.status === 'pending-upgrade') displayStatus = 'Provisioning';

      return {
        name: release.name,
        namespace: release.namespace,
        status: displayStatus,
        helmStatus: release.status,
        url: `http://${release.name}.local`,
        adminUrl: `http://${release.name}.local/wp-admin`,
        engine: 'woocommerce',
        created: cleanDate,
        updated: cleanDate,
        chart: release.chart
      };
    });
  } catch (error) {
    console.error('List stores failed:', error.message);
    return [];
  }
}

async function setupWooCommerce(storeName) {
  const namespace = storeName;
  try {
    // Wait for pod to be ready
    console.log(`[WOO-SETUP] Waiting for pod in namespace ${namespace}...`);
    await execAsync(
      `kubectl wait --for=condition=ready pod -l app=${storeName} -n ${namespace} --timeout=300s`,
      { timeout: 310000 }
    );

    const { stdout: podName } = await execAsync(
      `kubectl get pods -n ${namespace} -l app=${storeName} -o jsonpath="{.items[0].metadata.name}"`
    );
    const pod = podName.replace(/"/g, '').trim();
    console.log(`[WOO-SETUP] Pod ready: ${pod}`);

    // Helper to run commands inside the wordpress container
    const wpExec = (cmd) =>
      execAsync(
        `kubectl exec -n ${namespace} ${pod} -c wordpress -- bash -c "${cmd}"`,
        { timeout: 180000 }
      );

    // Wait for MariaDB to be fully ready
    // Write a small DB-check script into the container first (avoids escaping hell)
    console.log(`[WOO-SETUP] Waiting for database to initialize...`);
    const dbCheckPhp = `<?php $c = @new mysqli('127.0.0.1', getenv('WORDPRESS_DB_USER'), getenv('WORDPRESS_DB_PASSWORD'), getenv('WORDPRESS_DB_NAME')); if($c->connect_error) { echo 'FAIL'; exit(1); } echo 'OK'; $c->close();`;
    await new Promise((resolve, reject) => {
      const child = exec(
        `kubectl exec -i -n ${namespace} ${pod} -c wordpress -- bash -c "cat > /tmp/db-check.php"`,
        (err) => err ? reject(err) : resolve()
      );
      child.stdin.write(dbCheckPhp);
      child.stdin.end();
    });

    const maxDbRetries = 20;
    for (let i = 1; i <= maxDbRetries; i++) {
      try {
        await wpExec('php /tmp/db-check.php');
        console.log(`[WOO-SETUP] Database is ready!`);
        break;
      } catch {
        if (i === maxDbRetries) {
          console.error(`[WOO-SETUP] Database not ready after ${maxDbRetries} attempts`);
          throw new Error('Database never became ready');
        }
        console.log(`[WOO-SETUP] Database not ready yet (attempt ${i}/${maxDbRetries}), waiting 15s...`);
        await new Promise(r => setTimeout(r, 15000));
      }
    }

    // Extra wait to let WordPress finish its own DB setup
    console.log(`[WOO-SETUP] Waiting 30s for WordPress to finish DB initialization...`);
    await new Promise(r => setTimeout(r, 30000));

    // Install WP-CLI
    console.log(`[WOO-SETUP] Installing WP-CLI...`);
    await wpExec(
      'curl -sO https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && chmod +x wp-cli.phar && mv wp-cli.phar /usr/local/bin/wp'
    );

    // Install WordPress core (creates DB tables + admin user)
    console.log(`[WOO-SETUP] Installing WordPress core...`);
    await wpExec(
      `export WP_CLI_ALLOW_ROOT=1 && wp core install --path=/var/www/html --url=http://${storeName}.local --title='${storeName}' --admin_user=admin --admin_password=admin123 --admin_email=admin@${storeName}.local --skip-email`
    );

    // Retry wrapper for WP-CLI commands (database may still be settling)
    const wpExecRetry = async (cmd, label, retries = 3) => {
      for (let i = 1; i <= retries; i++) {
        try {
          const result = await wpExec(cmd);
          return result;
        } catch (err) {
          if (i === retries) throw err;
          console.log(`[WOO-SETUP] ${label} failed (attempt ${i}/${retries}), retrying in 15s...`);
          await new Promise(r => setTimeout(r, 15000));
        }
      }
    };

    // Install WooCommerce plugin
    console.log(`[WOO-SETUP] Installing WooCommerce plugin...`);
    await wpExecRetry(
      'export WP_CLI_ALLOW_ROOT=1 && wp plugin install woocommerce --activate --path=/var/www/html',
      'WooCommerce install',
      5
    );

    // Install Storefront theme
    console.log(`[WOO-SETUP] Installing Storefront theme...`);
    await wpExecRetry(
      'export WP_CLI_ALLOW_ROOT=1 && wp theme install storefront --activate --path=/var/www/html',
      'Storefront install',
      3
    );

    // Set currency and country
    console.log(`[WOO-SETUP] Configuring store settings...`);
    await wpExecRetry(
      'export WP_CLI_ALLOW_ROOT=1 && wp option update woocommerce_currency USD --path=/var/www/html && wp option update woocommerce_default_country US:CA --path=/var/www/html',
      'Currency settings',
      3
    );

    // Copy and run the PHP setup script (COD + sample product)
    const setupPhp = path.resolve(__dirname, '../woo-setup.php');
    if (fs.existsSync(setupPhp)) {
      const phpContent = fs.readFileSync(setupPhp, 'utf8');
      await new Promise((resolve, reject) => {
        const child = exec(
          `kubectl exec -i -n ${namespace} ${pod} -c wordpress -- bash -c "cat > /tmp/woo-setup.php"`,
          (err) => err ? reject(err) : resolve()
        );
        child.stdin.write(phpContent);
        child.stdin.end();
      });

      await wpExecRetry(
        'export WP_CLI_ALLOW_ROOT=1 && wp eval-file /tmp/woo-setup.php --path=/var/www/html',
        'PHP setup script',
        3
      );
    }

    console.log(`[WOO-SETUP] WooCommerce setup complete for ${storeName}`);
    return { success: true };
  } catch (error) {
    console.error(`[WOO-SETUP] Failed for ${storeName}:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { installStore, deleteStore, listStores, setupWooCommerce };

