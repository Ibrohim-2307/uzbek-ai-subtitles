const fs = require('fs');

function checkES3(filePath) {
    console.log('=== Checking: ' + filePath + ' ===');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    let issues = 0;
    lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const clean = line.replace(/\/\/.*$/, '');

        // const or let
        if (/\b(const|let)\s+[a-zA-Z_$]/.test(clean)) {
            console.log('Line ' + lineNum + ' [const/let]: ' + line.trim());
            issues++;
        }
        // arrow function
        if (/=>/.test(clean)) {
            console.log('Line ' + lineNum + ' [arrow]: ' + line.trim());
            issues++;
        }
        // backticks
        if (clean.indexOf('`') !== -1) {
            console.log('Line ' + lineNum + ' [template literal]: ' + line.trim());
            issues++;
        }
        // trailing comma
        if (/,\s*[}\]]/.test(clean)) {
            console.log('Line ' + lineNum + ' [trailing comma]: ' + line.trim());
            issues++;
        }
        // reserved words as unquoted properties
        if (/\b(default|delete|class|catch|import|export|extends)\s*:/.test(clean)) {
            console.log('Line ' + lineNum + ' [reserved prop]: ' + line.trim());
            issues++;
        }
    });
    console.log('Total issues in ' + filePath + ': ' + issues);
}

checkES3('d:/anti garavity loyhalar/plogin/host/shared.jsx');
checkES3('d:/anti garavity loyhalar/plogin/host/premiere.jsx');
checkES3('d:/anti garavity loyhalar/plogin/host/aftereffects.jsx');
