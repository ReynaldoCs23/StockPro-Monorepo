const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'resources', 'js', 'pages');

const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));

const skipFiles = ['Dashboard.jsx', 'MasterBarang.jsx', 'Login.jsx'];

files.forEach(file => {
    if (skipFiles.includes(file)) return;
    
    const filePath = path.join(pagesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Match export default function ComponentName({ props }) {
    // We use [\s\S]*? to handle multi-line props
    const sigRegex = /export\s+default\s+function\s+([A-Za-z0-9_]+)\s*\(([\s\S]*?)\)\s*\{/;
    const match = content.match(sigRegex);

    if (match) {
        const componentName = match[1];
        const propsStr = match[2].trim();
        
        if (!propsStr || propsStr === '') {
            console.log(`Skipping ${file} - No props found.`);
            return;
        }

        // Clean up props string (remove outer braces if present)
        let cleanProps = propsStr;
        if (cleanProps.startsWith('{') && cleanProps.endsWith('}')) {
            cleanProps = cleanProps.substring(1, cleanProps.length - 1);
        }

        // Split by comma and clean up each prop
        const propItems = cleanProps.split(',').map(p => {
            // handle default values like userPermissions = []
            return p.split('=')[0].trim();
        }).filter(p => p !== '');

        if (propItems.length === 0) {
            console.log(`Skipping ${file} - No props to extract.`);
            return;
        }

        // Build Zustand destructuring string
        const mappedProps = propItems.map(p => {
            if (p === 'addSimulatedLog') return 'addLog: addSimulatedLog';
            if (p === 'userPermissions') return 'currentUserPermissions: userPermissions';
            return p;
        });

        const zustandHook = `
    const { 
        ${mappedProps.join(', ')} 
    } = useAppStore();`;

        // Check if we need to manually define isAdminOrSuperadmin
        // Some components might receive it as a prop. Let's provide it if requested
        let additionalSetup = '';
        if (propItems.includes('isAdminOrSuperadmin') && !propItems.includes('currentUser')) {
             // If they ask for isAdminOrSuperadmin but NOT currentUser, we should fetch currentUser too!
             // Just safely redefine it if it was requested.
             // Wait, the destructuring already pulls isAdminOrSuperadmin from the store? No, store doesn't have it.
        }

        // Correctly handle isAdminOrSuperadmin
        // If it was in mappedProps, we should REMOVE it from mappedProps because it's not in the store,
        // and compute it locally.
        const storeProps = [];
        let needsAdminCalc = false;
        let needsCurrentUser = false;

        mappedProps.forEach(mp => {
            if (mp === 'isAdminOrSuperadmin') {
                needsAdminCalc = true;
            } else {
                storeProps.push(mp);
                if (mp === 'currentUser') needsCurrentUser = true;
            }
        });

        if (needsAdminCalc && !needsCurrentUser) {
            storeProps.push('currentUser'); // Pull it so we can calc
        }

        let storeDestructure = `    const { ${storeProps.join(', ')} } = useAppStore();`;
        if (needsAdminCalc) {
            storeDestructure += `\n    const isAdminOrSuperadmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Superadmin');`;
        }
        
        // Also companyProfile is safely pulled from store.

        // Replace the signature
        content = content.replace(sigRegex, `export default function ${componentName}() {\n${storeDestructure}`);

        // Inject import if not exists
        if (!content.includes('useAppStore')) {
            // Find last import
            const importRegex = /import\s+.*?;?\n/g;
            let lastMatch = null;
            let m;
            while ((m = importRegex.exec(content)) !== null) {
                lastMatch = m;
            }

            if (lastMatch) {
                const insertPos = lastMatch.index + lastMatch[0].length;
                content = content.slice(0, insertPos) + `import useAppStore from '../store/useAppStore';\n` + content.slice(insertPos);
            } else {
                content = `import useAppStore from '../store/useAppStore';\n` + content;
            }
        }

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Refactored ${file}`);
    } else {
        console.log(`Skipping ${file} - Signature not matched.`);
    }
});
