const fs = require('fs');
const path = require('path');

const directoryPath = 'c:/laragon/www/inventory-backend/resources/js';

function processDirectory(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else if (stat.isFile() && (fullPath.endsWith('.jsx') || fullPath.endsWith('.js'))) {
            let content = fs.readFileSync(fullPath, 'utf8');
            
            // Remove dark: classes
            const originalContent = content;
            content = content.replace(/\s*dark:[a-zA-Z0-9\-\[\]\#]+/g, '');
            
            // Also user says "bg-gray-900, bg-[#121212], text-gray-100" without dark. But I should be careful not to remove ALL dark backgrounds, what if the sidebar is supposed to be dark?
            // "Scan Sidebar.jsx: Ensure its background is a standard light theme (e.g., bg-white or bg-[#1e1e2d] if you specifically want a dark sidebar in light mode"
            
            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Eradicated dark classes in ${fullPath}`);
            }
        }
    }
}

processDirectory(directoryPath);
console.log('Sweep completed.');
