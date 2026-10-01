/**
 * O'zbekcha AI Subtitr - Brauzerda Test Qilish Serveri (Node.js)
 * Port: 3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = path.join(__dirname, '..');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/' || reqUrl === '/index.html') {
        reqUrl = '/client/index.html';
    }

    const filePath = path.join(ROOT, reqUrl);
    const ext = path.extname(filePath).toLowerCase();

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end("Fayl topilmadi: " + reqUrl);
            return;
        }

        res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(content);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n======================================================`);
    console.log(`   O'ZBEKCHA AI SUBTITR - BRAUZERDA KO'RISH FAOL`);
    console.log(`   Manzil: http://127.0.0.1:${PORT}`);
    console.log(`======================================================\n`);
});
