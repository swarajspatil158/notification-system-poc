const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const WebSocket = require('ws');
const path = require('path');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize SQLite database
const db = new sqlite3.Database('database.sqlite');

// Initialize database tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY,
    content TEXT,
    user_id INTEGER
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    post_id INTEGER,
    UNIQUE(user_id, post_id)
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    message TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert demo data
  db.run(`INSERT OR IGNORE INTO users (id, username) VALUES (1, 'john')`);
  db.run(`INSERT OR IGNORE INTO users (id, username) VALUES (2, 'jane')`);
  db.run(`INSERT OR IGNORE INTO posts (id, content, user_id) VALUES (1, 'Hello World!', 1)`);
  db.run(`INSERT OR IGNORE INTO posts (id, content, user_id) VALUES (2, 'Great day today', 2)`);
});

// WebSocket server on same port as HTTP server
const wss = new WebSocket.Server({ server });
const clients = new Map(); // userId -> websocket

wss.on('connection', (ws, req) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'auth' && data.userId) {
        clients.set(data.userId, ws);
        console.log(`User ${data.userId} connected`);
      }
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  ws.on('close', () => {
    // Remove client on disconnect
    for (let [userId, client] of clients) {
      if (client === ws) {
        clients.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  });
});

// In-memory notification queue
const notificationQueue = [];

// Background worker to process notifications
setInterval(() => {
  if (notificationQueue.length > 0) {
    const job = notificationQueue.shift();
    processNotification(job);
  }
}, 100); // Process every 100ms

function processNotification(job) {
  const { postId, likerId } = job;
  
  // Get post owner
  db.get('SELECT user_id FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err || !post) return;
    
    const postOwnerId = post.user_id;
    
    // Don't notify if user liked their own post
    if (postOwnerId === likerId) return;
    
    // Get liker username
    db.get('SELECT username FROM users WHERE id = ?', [likerId], (err, user) => {
      if (err || !user) return;
      
      const message = `${user.username} liked your post`;
      
      // Save notification to database
      db.run(
        'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
        [postOwnerId, message],
        function(err) {
          if (err) return;
          
          // Send real-time notification
          const client = clients.get(postOwnerId);
          if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'notification',
              id: this.lastID,
              message: message,
              timestamp: new Date().toISOString()
            }));
          }
        }
      );
    });
  });
}

// API Routes

// Get posts
app.get('/api/posts', (req, res) => {
  db.all(`
    SELECT p.*, u.username,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count
    FROM posts p 
    JOIN users u ON p.user_id = u.id
  `, (err, posts) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(posts);
  });
});

// Like a post
app.post('/api/posts/:postId/like', (req, res) => {
  const postId = req.params.postId;
  const userId = req.body.userId; // In real app, get from auth
  
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  // Insert like
  db.run(
    'INSERT OR IGNORE INTO likes (user_id, post_id) VALUES (?, ?)',
    [userId, postId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      if (this.changes > 0) {
        // Add to notification queue (async processing)
        notificationQueue.push({ postId: parseInt(postId), likerId: userId });
      }
      
      // Get updated like count
      db.get('SELECT COUNT(*) as count FROM likes WHERE post_id = ?', [postId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, likeCount: result.count });
      });
    }
  );
});

// Get notifications
app.get('/api/notifications/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.all(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
    [userId],
    (err, notifications) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(notifications);
    }
  );
});

// Mark notification as read
app.put('/api/notifications/:id/read', (req, res) => {
  const notificationId = req.params.id;
  
  db.run(
    'UPDATE notifications SET is_read = 1 WHERE id = ?',
    [notificationId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on same port`);
});