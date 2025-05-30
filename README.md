# Notification System POC

Simple notification system for "like" operations demonstrating lightweight, cost-effective, non-blocking design.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the server:**
   ```bash
   npm start
   ```

3. **Open browser:**
   - Go to `http://localhost:3000`
   - Switch between users (John/Jane) to test notifications

## How It Works

### Architecture
- **API Server**: Express.js handles like requests
- **In-memory Queue**: Processes notifications asynchronously  
- **SQLite Database**: Stores likes and notifications
- **WebSocket**: Real-time notification delivery

### Test Flow
1. Switch to User 1 (John)
2. Like User 2's post
3. Switch to User 2 (Jane) 
4. See real-time notification appear
5. Click notification to mark as read

## File Structure
```
├── server.js          # Main server (API + WebSocket + Queue)
├── package.json       # Dependencies
├── public/
│   └── index.html     # Frontend
└── database.sqlite    # Auto-created SQLite database
```

## Key Features Demonstrated

✅ **Lightweight**: Single file server, SQLite, in-memory queue  
✅ **Cost-effective**: Zero external dependencies, free hosting  
✅ **Non-blocking**: Async notification processing doesn't affect like response  

## Deployment

**Free Options:**
- [Render](https://render.com) - Upload repo, auto-deploy
- [Railway](https://railway.app) - Connect GitHub, deploy
- [Glitch](https://glitch.com) - Import from GitHub

**Environment Variables:**
- `PORT` - Server port (default: 3000)

## API Endpoints

- `GET /api/posts` - Get all posts with like counts
- `POST /api/posts/:id/like` - Like a post (body: `{"userId": 1}`)  
- `GET /api/notifications/:userId` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read

## WebSocket Events

- Client sends: `{"type": "auth", "userId": 1}`
- Server sends: `{"type": "notification", "message": "...", "timestamp": "..."}`
