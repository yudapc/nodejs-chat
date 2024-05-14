// Import dependencies
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

// Create an Express app
const app = express();
app.use(
  cors({
    origin: "*",
  })
);
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ server });

// Connect to SQLite database
const db = new sqlite3.Database("chat.db", (err) => {
  if (err) {
    console.error("Error connecting to database:", err);
  } else {
    console.log("Connected to the database");
  }
});

// Create table for chat messages if not exists
db.run(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  sender TEXT NOT NULL,
  room TEXT NOT NULL
)`);

const getMessagesByRoom = (room, callback) => {
  db.all("SELECT * FROM messages WHERE room = ?", [room], callback);
}

const sendMessagesToCurrentClient = (room, ws) => {
  getMessagesByRoom(room, (err, rows) => {
    if (err) {
      console.error("Error retrieving messages:", err);
    } else {
      ws.send(JSON.stringify(rows));
    }
  });
}

const sendMessagesToAllClients = (room, wss) => {
  getMessagesByRoom(room, (err, rows) => {
    if (err) {
      console.error("Error retrieving messages:", err);
    } else {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(rows));
        }
      });
    }
  });
}

wss.on("connection", function connection(ws) {
  console.log("WS connection arrived");

  ws.on("message", function incoming(message) {
    console.log("received: %s", message);
    const dataJson = JSON.parse(message);
    const { event, data } = dataJson;

    console.log("event: ", event);

    if (event === "message") {
      const { text, sender, room } = data;

      // Insert the new message into the database
      db.run(
        "INSERT INTO messages (text, sender, room) VALUES (?, ?, ?)",
        [text, sender, room],
        (err) => {
          if (err) {
            console.error("Error saving message:", err);
          } else {
            // Broadcast the new message to all clients in the room
            sendMessagesToAllClients(room, wss);
          }
        }
      );
    }
    if (event === "joinRoom") {
      const { room } = data;
      sendMessagesToCurrentClient(room, ws);
    }
  });
});


// Set up routes
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
