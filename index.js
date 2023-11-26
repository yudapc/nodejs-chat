// Import dependencies
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const sqlite3 = require('sqlite3').verbose();

// Create an Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Connect to SQLite database
const db = new sqlite3.Database('chat.db', (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Connected to the database');
  }
});

// Create table for chat messages if not exists
db.run(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  sender TEXT NOT NULL,
  room TEXT NOT NULL
)`);

// Set up WebSocket connection
io.on('connection', (socket) => {
  console.log('A user connected');

  // Listen for joining a room
  socket.on('joinRoom', (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);

    // Get all messages for the room from the database
    db.all('SELECT * FROM messages WHERE room = ?', [room], (err, rows) => {
        if (err) {
          console.error('Error retrieving messages:', err);
        } else {
          // Emit the messages to the client
          socket.emit('messages', rows);
        }
      });
  });

  // Listen for new messages from the client
  socket.on('newMessage', (data) => {
    const { text, sender, room } = data;

    // Insert the new message into the database
    db.run('INSERT INTO messages (text, sender, room) VALUES (?, ?, ?)', [text, sender, room], (err) => {
      if (err) {
        console.error('Error saving message:', err);
      } else {
        // Broadcast the new message to all clients in the room
        io.to(room).emit('newMessage', { text, sender });
      }
    });
  });

  // Listen for disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Set up routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Start the server
server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});