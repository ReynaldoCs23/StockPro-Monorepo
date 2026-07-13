const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'resources', 'js', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
    const filePath = path.join(pagesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    if (content.includes('useAppStore') && !content.includes('import useAppStore')) {
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
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed import in ${file}`);
    }
});
