// relayServer.js
// A simple GunDB relay server with cleanup and rate-limiting
const Gun = require("gun");
const express = require("express");
const rateLimit = require("express-rate-limit");
const http = require("http");

// App setup
const app = express();
const port = 8765;

// Rate limiting to protect against abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: "Too many requests, please try again later.",
});

app.use(limiter); // Apply rate limiting to all endpoints

// Create HTTP server
const server = http.createServer(app);

// GunDB setup with persistent storage
const gun = Gun({
  web: server,
  file: "data", // Store messages persistently in 'data' folder
  radisk: true, // Enable persistent storage
});
const SEA = Gun.SEA;

const PARENT_NODE = "channels"; // Centralized parent node
const CLEANUP_INTERVAL = 1 * 60 * 1000; // Run cleanup every 1 minute
const NODE_TTL = 10 * 60 * 1000; // Nodes older than 10 minutes will be deleted

// Force writes into the PARENT_NODE
/*
gun.on("put", (data, key, ctx) => {
  console.log("Data written:", data);
  console.log("Key:", key);
  console.log("Context:", ctx);

  
  console.log("put key: ", key);
  if (!key || !key.startsWith(PARENT_NODE)) {
    console.warn(`Write rejected: ${key} is not under ${PARENT_NODE}`);
    if (ev) {
      ev.off(); // Stop the put operation
      console.log("NO put key: ", key);
    }
    return;
  }
  console.log(`Write allowed: ${key}`);
  
});
*/

// Cleanup process: remove stale child nodes
function cleanupChildNodes() {
  console.log("Running cleanup on child nodes...");
  const now = Date.now();

  // Iterate through child nodes of the parent
  gun
    .get(PARENT_NODE)
    .map()
    .once((childData, childKey) => {
      if (childData) {
        // Iterate through messages within each child node
        gun
          .get(PARENT_NODE)
          .get(childKey)
          .map()
          .once((messageData, messageKey) => {
            if (
              messageData &&
              messageData.timestamp &&
              now - messageData.timestamp > NODE_TTL
            ) {
              console.log(
                `Deleting stale message: ${messageKey} in child node: ${childKey}`
              );
              gun.get(PARENT_NODE).get(childKey).get(messageKey).put(null); // Nullify the message
            }
          });
      }
    });
}
setInterval(cleanupChildNodes, CLEANUP_INTERVAL); // Schedule cleanup

// Start server
server.listen(port, () => {
  console.log(
    `GunDB relay server with cleanup and rate-limiting running on port ${port}`
  );
});
