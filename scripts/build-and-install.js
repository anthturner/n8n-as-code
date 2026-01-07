#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const extensionDir = path.join(__dirname, '..', 'packages', 'vscode-extension');
const vsixName = 'n8n-as-code.vsix';
const vsixPath = path.join(extensionDir, vsixName);

try {
    console.log('🔧 Rebuilding the extension...');
    execSync('npm run build', { 
        cwd: extensionDir,
        stdio: 'inherit'
    });

    console.log('📦 Packaging the extension...');
    // Use npx to ensure vsce is available
    // Added --no-dependencies to avoid "invalid relative path" errors with symlinked packages in monorepo
    execSync(`npx @vscode/vsce package --out "${vsixName}" --no-dependencies`, { 
        cwd: extensionDir,
        stdio: 'inherit'
    });

    console.log('📁 Installing the extension...');
    execSync(`code --install-extension "${vsixPath}"`, { 
        stdio: 'inherit'
    });

    console.log('\n✅ Extension installed successfully!');
    console.log('💡 To test the SecretStorage persistence:');
    console.log('   1. Open a regular VS Code window (not the extension host)');
    console.log('   2. Authenticate in the n8n Webview');
    console.log('   3. Close VS Code completely');
    console.log('   4. Reopen VS Code and verify you are still logged in\n');

} catch (error) {
    console.error('\n❌ Error during build and install process:');
    console.error(error.message);
    process.exit(1);
}
