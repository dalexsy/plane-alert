const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3001;
const DB_FILE = path.join(__dirname, "src", "assets", "user-aircraft-db.json");

const server = http.createServer((req, res) => {
  // Enable CORS for local development
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === "/save-db" && req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        fs.writeFileSync(DB_FILE, data.content, "utf8");

        console.log(
          `✅ Updated src/assets/user-aircraft-db.json (${data.count} aircraft)`
        );

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        console.error("❌ Error writing database:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`📁 File server running on http://localhost:${PORT}`);
  console.log(`📝 Aircraft DB: ${DB_FILE}`);
});
