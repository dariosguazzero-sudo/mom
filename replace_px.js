const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');
content = content.replace(/(\d+)px/g, (match, p1) => {
    const val = Number(p1) / 16;
    return val + 'rem';
});
fs.writeFileSync('index.html', content);
console.log('done');
