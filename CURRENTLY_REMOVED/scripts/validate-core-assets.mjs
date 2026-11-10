import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const workspaceRoot = process.cwd();
const serviceWorkerPath = path.join(workspaceRoot, 'service-worker.js');

async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch (error) {
        return false;
    }
}

function extractCoreAssets(sourceText) {
    const arrayMatch = sourceText.match(/const\s+CORE_ASSETS\s*=\s*\[([\s\S]*?)\];/);
    if (!arrayMatch) {
        throw new Error('Could not find CORE_ASSETS array in service-worker.js');
    }

    const assetsSection = arrayMatch[1];
    const assetMatches = [...assetsSection.matchAll(/['"]([^'"]+)['"]/g)];
    return assetMatches.map((match) => match[1]);
}

function normalizeAssetPath(assetPath) {
    if (assetPath === '/') {
        return '/index.html';
    }

    if (assetPath.endsWith('/')) {
        return assetPath + 'index.html';
    }

    return assetPath;
}

async function main() {
    const serviceWorkerSource = await fs.readFile(serviceWorkerPath, 'utf8');
    const assets = extractCoreAssets(serviceWorkerSource);

    const missing = [];

    for (const asset of assets) {
        const normalized = normalizeAssetPath(asset);
        const relativePath = normalized.startsWith('/') ? normalized.slice(1) : normalized;
        const absolutePath = path.join(workspaceRoot, relativePath);

        if (!(await pathExists(absolutePath))) {
            missing.push(asset);
        }
    }

    if (missing.length) {
        console.error('Missing CORE_ASSETS entries:');
        for (const item of missing) {
            console.error('- ' + item);
        }
        process.exit(1);
    }

    console.log(`Validated ${assets.length} CORE_ASSETS entries successfully.`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});