const fs = require('fs');
const path = require('path');

const dir = 'c:\\laragon\\www\\inventory-backend\\resources\\js';

const extraClasses = 'dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400 dark:focus:border-blue-500 dark:focus:ring-blue-500';

function processDirectory(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Regex to find <input, <select, <textarea and their className=".."
            // We use a function to replace the className content
            const tagRegex = /<(input|select|textarea)([^>]+)className=(["'])([^"']*)(["'])/g;
            
            content = content.replace(tagRegex, (match, tag, before, quote1, classes, quote2) => {
                if (classes.includes('dark:bg-slate-800') && classes.includes('dark:text-slate-100')) {
                    return match; // Already applied
                }
                modified = true;
                return `<${tag}${before}className=${quote1}${classes} ${extraClasses}${quote2}`;
            });

            // Also check for className={`...`}
            const tagRegexTemplate = /<(input|select|textarea)([^>]+)className=\{`([^`]*)`\}/g;
            content = content.replace(tagRegexTemplate, (match, tag, before, classes) => {
                if (classes.includes('dark:bg-slate-800') && classes.includes('dark:text-slate-100')) {
                    return match;
                }
                modified = true;
                return `<${tag}${before}className={\`${classes} ${extraClasses}\`}`;
            });


            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Modified: ${fullPath}`);
            }
        }
    }
}

processDirectory(dir);
console.log("Form sweep complete.");
