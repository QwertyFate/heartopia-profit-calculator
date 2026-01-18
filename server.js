// Simple Node.js server to handle recipe.json file operations
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const RECIPE_FILE = path.join(__dirname, 'recipe.json');

// Ensure recipe.json exists
if (!fs.existsSync(RECIPE_FILE)) {
    fs.writeFileSync(RECIPE_FILE, '[]');
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Serve static files
    if (req.url === '/' || req.url === '/index.html') {
        const filePath = path.join(__dirname, 'index.html');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(filePath).pipe(res);
        return;
    }
    
    if (req.url === '/index.js') {
        const filePath = path.join(__dirname, 'index.js');
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        fs.createReadStream(filePath).pipe(res);
        return;
    }
    
    // Serve data.json (GET)
    if (req.method === 'GET' && req.url === '/data.json') {
        const filePath = path.join(__dirname, 'data.json');
        if (fs.existsSync(filePath)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('data.json not found');
        }
        return;
    }
    
    // POST /data.json - Save ingredient data
    if (req.method === 'POST' && parsedUrl.pathname === '/data.json') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const dataFilePath = path.join(__dirname, 'data.json');
                fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON data' }));
            }
        });
        return;
    }
    
    // GET /recipes - Read recipes
    if (req.method === 'GET' && parsedUrl.pathname === '/recipes') {
        try {
            const data = fs.readFileSync(RECIPE_FILE, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to read recipes' }));
        }
        return;
    }
    
    // POST /recipes - Save recipes
    if (req.method === 'POST' && parsedUrl.pathname === '/recipes') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const recipes = JSON.parse(body);
                fs.writeFileSync(RECIPE_FILE, JSON.stringify(recipes, null, 2));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON data' }));
            }
        });
        return;
    }
    
    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Recipe file: ${RECIPE_FILE}`);
});
