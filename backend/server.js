const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// ─── MongoDB Connection ───────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ─── Schemas ──────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },   // Firebase UID
  email: String,
  displayName: String,
  photoURL: String,
  username: { type: String, unique: true, sparse: true },  // @username
  bio: { type: String, default: '' },
  online: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  chatId: { type: String, required: true, index: true },
  sender: { type: String, required: true },   // uid
  senderUsername: String,
  senderName: String,
  text: { type: String, required: true },
  replyTo: {
    messageId: String,
    text: String,
    senderName: String
  },
  edited: { type: Boolean, default: false },
  editedAt: Date,
  reactions: [{ emoji: String, uid: String }],
  forwarded: { type: Boolean, default: false },
  read: [String],   // array of uids who read it
  createdAt: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },  // sorted uid1_uid2
  participants: [String],  // array of uids
  lastMessage: {
    text: String,
    sender: String,
    createdAt: Date
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const Chat = mongoose.model('Chat', chatSchema);

// ─── Helper ───────────────────────────────────────────────────────────────────
function makeChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

// ─── REST API Routes ──────────────────────────────────────────────────────────

// Register / login user (called after Firebase auth)
app.post('/api/users/register', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL } = req.body;
    let user = await User.findOne({ uid });
    if (!user) {
      user = await User.create({ uid, email, displayName, photoURL });
    } else {
      user.displayName = displayName;
      user.photoURL = photoURL;
      await user.save();
    }
    res.json({ user, needsUsername: !user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set username
app.post('/api/users/set-username', async (req, res) => {
  try {
    const { uid, username } = req.body;
    const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (clean.length < 3) return res.status(400).json({ error: 'Username too short (min 3 chars)' });
    const exists = await User.findOne({ username: clean });
    if (exists && exists.uid !== uid) return res.status(409).json({ error: 'Username already taken' });
    const user = await User.findOneAndUpdate({ uid }, { username: clean }, { new: true });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check username availability
app.get('/api/users/check-username/:username', async (req, res) => {
  const clean = req.params.username.toLowerCase();
  const exists = await User.findOne({ username: clean });
  res.json({ available: !exists });
});

// Search users by username
app.get('/api/users/search', async (req, res) => {
  const { q, uid } = req.query;
  if (!q) return res.json([]);
  const users = await User.find({
    username: { $regex: q, $options: 'i' },
    uid: { $ne: uid }
  }).limit(10).select('uid username displayName photoURL online lastSeen bio');
  res.json(users);
});

// Get user profile
app.get('/api/users/:uid', async (req, res) => {
  const user = await User.findOne({ uid: req.params.uid });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Update bio
app.patch('/api/users/:uid', async (req, res) => {
  const { bio, displayName } = req.body;
  const user = await User.findOneAndUpdate(
    { uid: req.params.uid },
    { bio, displayName },
    { new: true }
  );
  res.json(user);
});

// Get all chats for a user
app.get('/api/chats/:uid', async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.params.uid })
      .sort({ updatedAt: -1 });

    const enriched = await Promise.all(chats.map(async chat => {
      const otherUid = chat.participants.find(p => p !== req.params.uid);
      const otherUser = await User.findOne({ uid: otherUid }).select('uid username displayName online lastSeen');
      const unread = await Message.countDocuments({
        chatId: chat.chatId,
        sender: { $ne: req.params.uid },
        read: { $nin: [req.params.uid] }
      });
      return { ...chat.toObject(), otherUser, unread };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages for a chat
app.get('/api/messages/:chatId', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const messages = await Message.find({ chatId: req.params.chatId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark messages as read
app.post('/api/messages/read', async (req, res) => {
  const { chatId, uid } = req.body;
  await Message.updateMany(
    { chatId, sender: { $ne: uid }, read: { $nin: [uid] } },
    { $push: { read: uid } }
  );
  res.json({ ok: true });
});

// Delete message
app.delete('/api/messages/:messageId', async (req, res) => {
  await Message.findByIdAndDelete(req.params.messageId);
  res.json({ ok: true });
});

// Edit message
app.patch('/api/messages/:messageId', async (req, res) => {
  const msg = await Message.findByIdAndUpdate(
    req.params.messageId,
    { text: req.body.text, edited: true, editedAt: new Date() },
    { new: true }
  );
  res.json(msg);
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const onlineUsers = new Map(); // uid -> socketId

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  // User comes online
  socket.on('user:online', async ({ uid }) => {
    onlineUsers.set(uid, socket.id);
    socket.data.uid = uid;
    await User.findOneAndUpdate({ uid }, { online: true, lastSeen: new Date() });
    io.emit('user:status', { uid, online: true });
  });

  // Join chat room
  socket.on('chat:join', ({ chatId }) => {
    socket.join(chatId);
  });

  // Send message
  socket.on('message:send', async (data) => {
    try {
      const { chatId, senderUid, receiverUid, text, replyTo, forwarded } = data;
      const senderUser = await User.findOne({ uid: senderUid }).select('username displayName');

      // Create or update chat
      await Chat.findOneAndUpdate(
        { chatId },
        {
          chatId,
          participants: [senderUid, receiverUid],
          lastMessage: { text, sender: senderUid, createdAt: new Date() },
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      // Save message
      const msg = await Message.create({
        chatId,
        sender: senderUid,
        senderUsername: senderUser?.username,
        senderName: senderUser?.displayName,
        text,
        replyTo: replyTo || null,
        forwarded: forwarded || false,
        read: [senderUid]
      });

      // Emit to both users in the room
      io.to(chatId).emit('message:new', msg);

      // Notify receiver if not in chat
      const receiverSocketId = onlineUsers.get(receiverUid);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('chat:update', {
          chatId,
          lastMessage: { text, sender: senderUid, createdAt: new Date() },
          senderName: senderUser?.displayName
        });
      }
    } catch (err) {
      console.error('message:send error', err);
    }
  });

  // Typing indicator
  socket.on('typing:start', ({ chatId, uid, name }) => {
    socket.to(chatId).emit('typing:start', { uid, name });
  });
  socket.on('typing:stop', ({ chatId, uid }) => {
    socket.to(chatId).emit('typing:stop', { uid });
  });

  // Message reaction
  socket.on('message:react', async ({ messageId, emoji, uid }) => {
    const msg = await Message.findById(messageId);
    if (!msg) return;
    const existing = msg.reactions.findIndex(r => r.uid === uid && r.emoji === emoji);
    if (existing >= 0) msg.reactions.splice(existing, 1);
    else msg.reactions.push({ emoji, uid });
    await msg.save();
    io.to(msg.chatId).emit('message:reaction', { messageId, reactions: msg.reactions });
  });

  // Edit message
  socket.on('message:edit', async ({ messageId, text, chatId }) => {
    const msg = await Message.findByIdAndUpdate(
      messageId,
      { text, edited: true, editedAt: new Date() },
      { new: true }
    );
    io.to(chatId).emit('message:edited', msg);
  });

  // Delete message
  socket.on('message:delete', async ({ messageId, chatId }) => {
    await Message.findByIdAndDelete(messageId);
    io.to(chatId).emit('message:deleted', { messageId });
  });

  // Mark read
  socket.on('messages:read', async ({ chatId, uid }) => {
    await Message.updateMany(
      { chatId, sender: { $ne: uid }, read: { $nin: [uid] } },
      { $push: { read: uid } }
    );
    io.to(chatId).emit('messages:read', { uid });
  });

  // Disconnect
  socket.on('disconnect', async () => {
    const uid = socket.data.uid;
    if (uid) {
      onlineUsers.delete(uid);
      await User.findOneAndUpdate({ uid }, { online: false, lastSeen: new Date() });
      io.emit('user:status', { uid, online: false });
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
