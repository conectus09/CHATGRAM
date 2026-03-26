// ============================================
// FIREBASE CONFIG
// ============================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// ============================================
// API ENDPOINT
// ============================================
const API_URL = "http://localhost:5000/api";

// ============================================
// GLOBAL STATE
// ============================================
let currentUser = null;
let currentUserData = null;
let currentChatId = null;
let allChats = [];
let allUsers = [];
let selectedMessageId = null;
let socket = null;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
    setupEventListeners();
    loadDarkModePreference();
});

function initializeAuth() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            currentUserData = await fetchUserData(user.uid);
            if (currentUserData) {
                showMainScreen();
                loadChats();
                loadAllUsers();
                initSocket();
            } else {
                await auth.signOut();
            }
        } else {
            currentUser = null;
            showAuthScreen();
        }
    });
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Auth Events
    document.getElementById('loginBtn')?.addEventListener('click', loginUser);
    
    // Main App Events
    document.getElementById('newChatBtn')?.addEventListener('click', openNewChat);
    document.getElementById('menuBtn')?.addEventListener('click', openSettings);
    document.getElementById('sendBtn')?.addEventListener('click', sendMessage);
    document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Search
    document.getElementById('chatSearch')?.addEventListener('input', searchChats);
    document.getElementById('userSearch')?.addEventListener('input', searchUsers);

    // Tabs
    document.querySelectorAll('.tab')?.forEach(tab => {
        tab.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });

    // Dark Mode
    document.getElementById('darkModeToggle')?.addEventListener('change', toggleDarkMode);
}

// ============================================
// AUTH FUNCTIONS
// ============================================
async function sendOTP() {
    const phoneNumber = document.getElementById('phoneNumber').value;
    const countryCode = document.getElementById('countryCode').value;

    if (!phoneNumber) {
        showError('Enter phone number');
        return;
    }

    showLoading(true);

    // Check if user exists
    try {
        const res = await fetch(`${API_URL}/users/by-phone/${countryCode}${phoneNumber}`);
        if (res.ok) {
            // User exists, show login
            showAuthForm('loginScreen');
            document.getElementById('loginEmail').value = (await res.json()).email;
        } else {
            // New user, ask for profile
            showAuthForm('profileScreen');
            document.getElementById('otpPhoneDisplay').textContent = `${countryCode} ${phoneNumber}`;
        }
    } catch (error) {
        console.error('Error:', error);
    }

    showLoading(false);
}

async function verifyOTP() {
    const otpInputs = document.querySelectorAll('.otp-input');
    const otp = Array.from(otpInputs).map(input => input.value).join('');

    if (otp.length !== 6) {
        showError('Enter valid OTP');
        return;
    }

    showLoading(true);

    // In a real app, verify OTP with Twilio or similar service
    // For now, we'll just move to profile setup
    setTimeout(() => {
        showAuthForm('profileScreen');
        showLoading(false);
    }, 1000);
}

async function completeProfile() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const username = document.getElementById('username').value.trim().toLowerCase();
    const avatar = document.getElementById('avatarFile').files[0];

    if (!firstName || !username) {
        showError('Fill all required fields');
        return;
    }

    showLoading(true);

    try {
        // Check username availability
        const checkRes = await fetch(`${API_URL}/users/check-username/${username}`);
        const checkData = await checkRes.json();

        if (!checkData.available) {
            showError('Username already taken');
            showLoading(false);
            return;
        }

        // Create Firebase user with email
        const email = `${username}@telegram.local`;
        const password = Math.random().toString(36).slice(-12);

        const authRes = await auth.createUserWithEmailAndPassword(email, password);
        const uid = authRes.user.uid;

        // Upload avatar if provided
        let avatarUrl = null;
        if (avatar) {
            avatarUrl = await uploadToCloudinary(avatar);
        }

        // Create user in MongoDB
        const userRes = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid,
                username,
                name: `${firstName} ${lastName}`,
                email,
                phoneNumber: `${document.getElementById('countryCode').value}${document.getElementById('phoneNumber').value}`,
                avatar: avatarUrl || generateDefaultAvatar(`${firstName} ${lastName}`),
                status: 'Hey! Using Telegram',
                bio: '',
                isOnline: true,
                createdAt: new Date()
            })
        });

        if (userRes.ok) {
            // Login automatically
            await auth.signInWithEmailAndPassword(email, password);
        }
    } catch (error) {
        showError(getFirebaseErrorMessage(error));
    } finally {
        showLoading(false);
    }
}

async function loginUser() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showError('Fill all fields');
        return;
    }

    showLoading(true);

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        showError(getFirebaseErrorMessage(error));
    } finally {
        showLoading(false);
    }
}

async function logoutUser() {
    if (confirm('Logout?')) {
        try {
            showLoading(true);
            
            // Set offline
            await fetch(`${API_URL}/users/${currentUser.uid}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isOnline: false,
                    lastSeen: new Date()
                })
            });

            if (socket) socket.disconnect();
            await auth.signOut();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            showLoading(false);
        }
    }
}

// ============================================
// DATABASE FUNCTIONS
// ============================================
async function fetchUserData(uid) {
    try {
        const res = await fetch(`${API_URL}/users/${uid}`);
        if (res.ok) return await res.json();
    } catch (error) {
        console.error('Error fetching user:', error);
    }
    return null;
}

async function loadChats() {
    try {
        const res = await fetch(`${API_URL}/chats/${currentUser.uid}`);
        if (res.ok) {
            allChats = await res.json();
            displayChats(allChats);
        }
    } catch (error) {
        console.error('Error loading chats:', error);
    }
}

async function loadAllUsers() {
    try {
        const res = await fetch(`${API_URL}/users`);
        if (res.ok) {
            allUsers = (await res.json()).filter(u => u.uid !== currentUser.uid);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function loadMessages(chatId) {
    try {
        const res = await fetch(`${API_URL}/messages/${chatId}`);
        if (res.ok) {
            const messages = await res.json();
            displayMessages(messages);
            scrollToBottom();
            markMessagesAsRead(chatId);
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

async function markMessagesAsRead(chatId) {
    try {
        await fetch(`${API_URL}/messages/read/${chatId}/${currentUser.uid}`, {
            method: 'PUT'
        });
    } catch (error) {
        console.error('Error marking as read:', error);
    }
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const text = messageInput.value.trim();

    if (!text || !currentChatId) return;

    try {
        const messageData = {
            chatId: currentChatId,
            senderId: currentUser.uid,
            senderName: currentUserData.name,
            senderUsername: currentUserData.username,
            senderAvatar: currentUserData.avatar,
            messageType: 'text',
            text,
            timestamp: new Date(),
            readBy: [{ userId: currentUser.uid, readAt: new Date() }]
        };

        const res = await fetch(`${API_URL}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData)
        });

        if (res.ok) {
            messageInput.value = '';
            
            if (socket) {
                socket.emit('new_message', await res.json());
            }
            
            await loadMessages(currentChatId);
            await loadChats();
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message');
    }
}

// ============================================
// CHAT MANAGEMENT
// ============================================
async function createDirectChat(userId) {
    try {
        showLoading(true);

        // Check if chat exists
        let existingChat = allChats.find(chat =>
            (chat.chatType === 'direct' &&
            ((chat.participants[0].userId === currentUser.uid && chat.participants[1].userId === userId) ||
            (chat.participants[0].userId === userId && chat.participants[1].userId === currentUser.uid)))
        );

        if (existingChat) {
            selectChat(existingChat._id);
            closeModal('newChatModal');
            showLoading(false);
            return;
        }

        // Create new chat
        const otherUser = allUsers.find(u => u.uid === userId);
        const chatData = {
            chatType: 'direct',
            participants: [
                {
                    userId: currentUser.uid,
                    username: currentUserData.username,
                    name: currentUserData.name,
                    avatar: currentUserData.avatar,
                    joinedAt: new Date()
                },
                {
                    userId: otherUser.uid,
                    username: otherUser.username,
                    name: otherUser.name,
                    avatar: otherUser.avatar,
                    joinedAt: new Date()
                }
            ],
            createdAt: new Date()
        };

        const res = await fetch(`${API_URL}/chats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chatData)
        });

        if (res.ok) {
            const newChat = await res.json();
            allChats.unshift(newChat);
            selectChat(newChat._id);
            closeModal('newChatModal');
        }
    } catch (error) {
        console.error('Error creating chat:', error);
        showToast('Failed to create chat');
    } finally {
        showLoading(false);
    }
}

async function selectChat(chatId) {
    currentChatId = chatId;
    const chat = allChats.find(c => c._id === chatId);

    if (chat) {
        // Update UI
        document.getElementById('noChatSelected').classList.add('hidden');
        document.getElementById('chatWindow').classList.remove('hidden');

        if (chat.chatType === 'direct') {
            const otherParticipant = chat.participants.find(p => p.userId !== currentUser.uid);
            document.getElementById('chatName').textContent = otherParticipant.name;
            document.getElementById('chatStatus').textContent = `@${otherParticipant.username}`;
        } else {
            document.getElementById('chatName').textContent = chat.chatName;
            document.getElementById('chatStatus').textContent = `${chat.participants.length} members`;
        }

        // Update active chat
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.chatId === chatId) {
                item.classList.add('active');
            }
        });

        await loadMessages(chatId);
    }
}

function displayChats(chats) {
    const chatsList = document.getElementById('chatsList');
    chatsList.innerHTML = '';

    if (chats.length === 0) {
        chatsList.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">No chats yet</p>';
        return;
    }

    chats.forEach(chat => {
        let chatName = '';
        let chatUsername = '';
        let avatar = '';

        if (chat.chatType === 'direct') {
            const otherParticipant = chat.participants.find(p => p.userId !== currentUser.uid);
            chatName = otherParticipant.name;
            chatUsername = otherParticipant.username;
            avatar = otherParticipant.avatar;
        } else {
            chatName = chat.chatName;
            avatar = chat.chatIcon;
        }

        const unreadCount = chat.participants.find(p => p.userId === currentUser.uid)?.unreadCount || 0;

        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chat._id;
        chatItem.innerHTML = `
            <div class="chat-avatar" style="background-image: url('${avatar}'); background-size: cover;">
                ${!avatar ? chatName.charAt(0).toUpperCase() : ''}
            </div>
            <div class="chat-info">
                <h3>${chatName}</h3>
                <p>${chat.lastMessage?.text.substring(0, 40) || 'No messages'}</p>
            </div>
            ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
        `;
        chatItem.addEventListener('click', () => selectChat(chat._id));
        chatsList.appendChild(chatItem);
    });
}

function displayMessages(messages) {
    const container = document.getElementById('messagesArea');
    container.innerHTML = '';

    messages.forEach((msg, index) => {
        const isSent = msg.senderId === currentUser.uid;
        const previousMsg = messages[index - 1];
        const showAvatar = !previousMsg || previousMsg.senderId !== msg.senderId;
        const time = new Date(msg.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        const messageGroup = document.createElement('div');
        messageGroup.className = `message-group ${isSent ? 'sent' : 'received'}`;
        messageGroup.dataset.messageId = msg._id;

        let contentHTML = '';

        if (msg
