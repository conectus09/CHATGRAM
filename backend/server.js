const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }
});

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// ============================================
// MONGODB CONNECTION
// ============================================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/telegram', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ============================================
// SCHEMAS & MODELS
// ============================================

// User Schema
const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true, index: true },
  email: { type: String, unique: true, sparse: true },
  name: String,
  username: { type: String, unique: true, sparse: true, lowercase: true, index: true },
  avatar: String,
  bio: { type: String, default: '' },
  status: { type: String, default: 'Hey! Using Telegram' },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  blockedUsers: [String],
  privacySettings: {
    lastSeen: { type: String, default: 'everyone' },
    profilePhoto: { type: String, default: 'everyone' },
    readReceipts: { type: Boolean, default: true }
  },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Chat Schema
const chatSchema = new mongoose.Schema({
  chatType: { type: String, enum: ['direct', 'group'], default: 'direct' },
  participants: [{
    userId: String,
    username: String,
    name: String,
    avatar: String,
    joinedAt: { type: Date, default: Date.now },
    isAdmin: { type: Boolean, default: false }
  }],
  chatName: String,
  chatDescription: String,
  chatIcon: String,
  createdBy: String,
  isArchived: { type: Boolean, default: false },
  isPinned: { type: Boolean, default: false },
  lastMessage: {
    messageId: String,
    text: String,
    senderId: String,
    senderName: String,
    timestamp: Date
  },
  updatedAt: { type: Date, default: Date.now, index: -1 },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Message Schema
const messageSchema = new mongoose.Schema({
  chatId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderName: String,
  senderUsername: String,
  senderAvatar: String,
  messageType: { type: String, enum: ['text', 'photo', 'video', 'audio', 'document', 'sticker'], default: 'text' },
  text: String,
  media: {
    type: String,
    url: String,
    fileName: String,
    fileSize: Number,
    thumbnail: String
  },
  replyTo: {
    messageId: String,
    text: String,
    senderName: String
  },
  reactions: [{
    emoji: String,
    userId: String,
    addedAt: { type: Date, default: Date.now }
  }],
  readBy: [{
    userId: String,
    readAt: { type: Date, default: Date.now }
  }],
  isPinned: { type: Boolean, default: false },
  isEdited: { type: Boolean, default: false },
  editedAt: Date,
  isDeleted: { type: Boolean, default: false },
  forwardedFrom: {
    chatId: String,
    messageId: String,
    senderName: String
  },
  timestamp: { type: Date, default: Date.now, index: -1 },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Call Schema
const callSchema = new mongoose.Schema({
  chatId: String,
  callerId: String,
  callerName: String,
  receiverId: String,
  receiverName: String,
  callType: { type: String, enum: ['voice', 'video'] },
  callStatus: { type: String, enum: ['ringing', 'accepted', 'ended', 'missed'], default: 'ringing' },
  startTime: Date,
  endTime: Date,
  duration: Number,
  createdAt: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Chat = mongoose.model('Chat', chatSchema);
const Message = mongoose.model('Message', messageSchema);
const Call = mongoose.model('Call', callSchema);

// ============================================
// HELPER FUNCTIONS
// ============================================

function makeChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

// ============================================
// REST API ROUTES
// ============================================

// ========== USER ROUTES ==========

// Register/Create User Profile
app.post('/api/users', async (req, res) => {
  try {
    const { uid, email, name, username, avatar, bio, status } = req.body;

    // Check if user already exists
    let user = await User.findOne({ uid });
    if (user) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Check if username is taken
    if (username) {
      const existingUsername = await User.findOne({ username: username.toLowerCase() });
      if (existingUsername) {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }

    // Create new user
    user = await User.create({
      uid,
      email,
      name,
      username: username?.toLowerCase(),
      avatar,
      bio: bio || '',
      status: status || 'Hey! Using Telegram',
      isOnline: true
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get User by UID
app.get('/api/users/:uid', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('uid username name avatar status isOnline lastSeen bio');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check Username Availability
app.get('/api/users/check-username/:username', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username });
    res.json({ available: !user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search Users by Username or Name
app.get('/api/users/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } }
      ]
    }).limit(20).select('uid username name avatar status isOnline bio');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update User Profile
app.put('/api/users/:uid', async (req, res) => {
  try {
    const { name, avatar, bio, status, isOnline, lastSeen, privacySettings } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (avatar) updateData.avatar = avatar;
    if (bio !== undefined) updateData.bio = bio;
    if (status) updateData.status = status;
    if (isOnline !== undefined) updateData.isOnline = isOnline;
    if (lastSeen) updateData.lastSeen = lastSeen;
    if (privacySettings) updateData.privacySettings = privacySettings;

    const user = await User.findOneAndUpdate(
      { uid: req.params.uid },
      updateData,
      { new: true }
    );

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CHAT ROUTES ==========

// Get All Chats for a User
app.get('/api/chats/:userId', async (req, res) => {
  try {
    const chats = await Chat.find({
      'participants.userId': req.params.userId
    }).sort({ updatedAt: -1 });

    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create New Chat
app.post('/api/chats', async (req, res) => {
  try {
    const { chatType, participants, chatName, chatDescription, chatIcon, createdBy } = req.body;

    // Check if chat already exists (for direct chats)
    if (chatType === 'direct' && participants.length === 2) {
      const existingChat = await Chat.findOne({
        chatType: 'direct',
        'participants.userId': {
          $all: [participants[0].userId, participants[1].userId]
        }
      });

      if (existingChat) {
        return res.json(existingChat);
      }
    }

    const chat = await Chat.create({
      chatType,
      participants,
      chatName,
      chatDescription,
      chatIcon,
      createdBy
    });

    res.status(201).json(chat);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update Chat
app.put('/api/chats/:chatId', async (req, res) => {
  try {
    const { chatName, chatDescription, chatIcon, isArchived, isPinned } = req.body;
    const updateData = {};

    if (chatName !== undefined) updateData.chatName = chatName;
    if (chatDescription !== undefined) updateData.chatDescription = chatDescription;
    if (chatIcon !== undefined) updateData.chatIcon = chatIcon;
    if (isArchived !== undefined) updateData.isArchived = isArchived;
    if (isPinned !== undefined) updateData.isPinned = isPinned;
    updateData.updatedAt = new Date();

    const chat = await Chat.findByIdAndUpdate(
      req.params.chatId,
      updateData,
      { new: true }
    );

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Chat
app.delete('/api/chats/:chatId', async (req, res) => {
  try {
    await Chat.findByIdAndDelete(req.params.chatId);
    await Message.deleteMany({ chatId: req.params.chatId });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== MESSAGE ROUTES ==========

// Get Messages for a Chat
app.get('/api/messages/:chatId', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ chatId: req.params.chatId })
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments({ chatId: req.params.chatId });

    res.json({
      messages,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Message
app.post('/api/messages', async (req, res) => {
  try {
    const {
      chatId,
      senderId,
      senderName,
      senderUsername,
      senderAvatar,
      messageType,
      text,
      media,
      replyTo,
      forwarded
    } = req.body;

    const message = await Message.create({
      chatId,
      senderId,
      senderName,
      senderUsername,
      senderAvatar,
      messageType,
      text,
      media,
      replyTo: replyTo || null,
      forwardedFrom: forwarded || null,
      readBy: [{ userId: senderId, readAt: new Date() }]
    });

    // Update chat's last message
    await Chat.findByIdAndUpdate(
      chatId,
      {
        lastMessage: {
          messageId: message._id,
          text: text?.substring(0, 100),
          senderId,
          senderName,
          timestamp: new Date()
        },
        updatedAt: new Date()
      }
    );

    res.status(201).json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark Messages as Read
app.put('/api/messages/read/:chatId/:userId', async (req, res) => {
  try {
    await Message.updateMany(
      {
        chatId: req.params.chatId,
        senderId: { $ne: req.params.userId },
        'readBy.userId': { $ne: req.params.userId }
      },
      {
        $push: {
          readBy: {
            userId: req.params.userId,
            readAt: new Date()
          }
        }
      }
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Edit Message
app.patch('/api/messages/:messageId', async (req, res) => {
  try {
    const { text } = req.body;
    const message = await Message.findByIdAndUpdate(
      req.params.messageId,
      {
        text,
        isEdited: true,
        editedAt: new Date()
      },
      { new: true }
    );

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Message
app.delete('/api/messages/:messageId', async (req, res) => {
  try {
    await Message.findByIdAndUpdate(
      req.params.messageId,
      { isDeleted: true }
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add Reaction to Message
app.post('/api/messages/:messageId/reaction', async (req, res) => {
  try {
    const { emoji, userId } = req.body;
    const message = await Message.findById(req.params.messageId);

    if (!message) return res.status(404).json({ error: 'Message not found' });

    const reactionIndex = message.reactions.findIndex(
      r => r.emoji === emoji && r.userId === userId
    );

    if (reactionIndex >= 0) {
      message.reactions.splice(reactionIndex, 1);
    } else {
      message.reactions.push({
        emoji,
        userId,
        addedAt: new Date()
      });
    }

    await message.save();
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CALL ROUTES ==========

// Create Call
app.post('/api/calls', async (req, res) => {
  try {
    const { chatId, callerId, callerName, receiverId, receiverName, callType } = req.body;

    const call = await Call.create({
      chatId,
      callerId,
      callerName,
      receiverId,
      receiverName,
      callType,
      callStatus: 'ringing'
    });

    res.status(201).json(call);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Call Status
app.put('/api/calls/:callId', async (req, res) => {
  try {
    const { callStatus, endTime, duration } = req.body;
    const updateData = { callStatus };

    if (endTime) updateData.endTime = endTime;
    if (duration) updateData.duration = duration;
    if (callStatus === 'accepted') updateData.startTime = new Date();

    const call = await Call.findByIdAndUpdate(
      req.params.callId,
      updateData,
      { new: true }
    );

    res.json(call);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SOCKET.IO REAL-TIME EVENTS
// ============================================

const onlineUsers = new Map(); // uid -> socketId

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  // User comes online
  socket.on('user:online', async (data) => {
    const { uid, username, name } = data;
    onlineUsers.set(uid, socket.id);
    socket.data.uid = uid;

    // Update user status
    await User.findOneAndUpdate(
      { uid },
      { isOnline: true, lastSeen: new Date() }
    );

    // Notify all users
    io.emit('user:status', { uid, online: true, username, name });
    console.log(`✅ ${username} is online`);
  });

  // Join chat room
  socket.on('chat:join', (chatId) => {
    socket.join(chatId);
    socket.to(chatId).emit('user:joined', { uid: socket.data.uid });
  });

  // Leave chat room
  socket.on('chat:leave', (chatId) => {
    socket.leave(chatId);
    socket.to(chatId).emit('user:left', { uid: socket.data.uid });
  });

  // Send message
  socket.on('message:send', (data) => {
    const { chatId } = data;
    io.to(chatId).emit('message:new', data);
  });

  // Message reaction
  socket.on('message:react', (data) => {
    const { chatId } = data;
    io.to(chatId).emit('message:reaction', data);
  });

  // Edit message
  socket.on('message:edit', (data) => {
    const { chatId } = data;
    io.to(chatId).emit('message:edited', data);
  });

  // Delete message
  socket.on('message:delete', (data) => {
    const { chatId } = data;
    io.to(chatId).emit('message:deleted', data);
  });

  // Typing indicator
  socket.on('typing:start', (data) => {
    const { chatId, uid, name } = data;
    socket.to(chatId).emit('typing:start', { uid, name });
  });

  socket.on('typing:stop', (data) => {
    const { chatId, uid } = data;
    socket.to(chatId).emit('typing:stop', { uid });
  });

  // Read messages
  socket.on('messages:read', (data) => {
    const { chatId, uid } = data;
    io.to(chatId).emit('messages:read', { uid });
  });

  // Initiate call
  socket.on('call:initiate', (data) => {
    const { receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('call:incoming', data);
    }
  });

  // Call accepted
  socket.on('call:accepted', (data) => {
    const { callerId } = data;
    const callerSocketId = onlineUsers.get(callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call:accepted', data);
    }
  });

  // Call rejected
  socket.on('call:rejected', (data) => {
    const { callerId } = data;
    const callerSocketId = onlineUsers.get(callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call:rejected', data);
    }
  });

  // Call ended
  socket.on('call:ended', (data) => {
    const { receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('call:ended', data);
    }
  });

  // User disconnect
  socket.on('disconnect', async () => {
    const uid = socket.data.uid;
    if (uid) {
      onlineUsers.delete(uid);

      // Update user status
      await User.findOneAndUpdate(
        { uid },
        { isOnline: false, lastSeen: new Date() }
      );

      // Notify all users
      io.emit('user:status', { uid, online: false });
      console.log(`❌ User ${uid} disconnected`);
    }
  });

  // Error handling
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 Telegram Server Running`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`${'='.repeat(50)}\n`);
});
