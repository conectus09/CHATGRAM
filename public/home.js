// ============================================
// FIREBASE CONFIG
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyAkyuA8xY3LyBdNn9_l9aniAfJ7fjMS__0",
    authDomain: "bumpy-c0feb.firebaseapp.com",
    projectId: "bumpy-c0feb",
    storageBucket: "bumpy-c0feb.firebasestorage.app",
    messagingSenderId: "1007047112567",
    appId: "1:1007047112567:web:a14858e9d4c2d6de579372"
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
            showLoading(true);

            // Check if user profile exists in MongoDB
            const userData = await fetchUserData(user.uid);

            if (userData) {
                // User exists, show main app
                currentUserData = userData;
                showMainScreen();
                loadChats();
                loadAllUsers();
                initSocket();
            } else {
                // User doesn't exist, show profile setup
                showProfileScreen();
            }

            showLoading(false);
        } else {
            // No Firebase user, redirect to Google login
            window.location.href = '/google-login.html';
        }
    });
}

function setupEventListeners() {
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

    // Username check
    document.getElementById('username')?.addEventListener('blur', checkUsernameAvailability);

    // Tabs
    document.querySelectorAll('.tab')?.forEach(tab => {
        tab.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });

    // Dark Mode
    document.getElementById('darkModeToggle')?.addEventListener('change', toggleDarkMode);
}

// ============================================
// PROFILE SETUP
// ============================================
async function completeProfile() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const username = document.getElementById('username').value.trim().toLowerCase();
    const bio = document.getElementById('bio').value.trim();
    const avatarFile = document.getElementById('avatarFile').files[0];
    const errorEl = document.getElementById('authError');

    if (!firstName || !username) {
        showError(errorEl, 'Please fill First Name and Username');
        return;
    }

    // Validate username
    if (!/^[a-z0-9_]+$/.test(username)) {
        showError(errorEl, 'Username can only contain letters, numbers, and underscores');
        return;
    }

    showLoading(true);

    try {
        // Check if username exists
        const checkRes = await fetch(`${API_URL}/users/check-username/${username}`);
        const checkData = await checkRes.json();

        if (!checkData.available) {
            showError(errorEl, 'Username already taken! Try another.');
            showLoading(false);
            return;
        }

        // Upload avatar if provided
        let avatarUrl = null;
        if (avatarFile) {
            avatarUrl = await uploadToCloudinary(avatarFile);
        } else {
            avatarUrl = generateDefaultAvatar(firstName);
        }

        // Create user in MongoDB
        const userData = {
            uid: currentUser.uid,
            email: currentUser.email,
            name: `${firstName} ${lastName}`.trim(),
            username,
            avatar: avatarUrl,
            bio,
            status: 'Hey! Using Telegram',
            isOnline: true,
            lastSeen: new Date(),
            createdAt: new Date()
        };

        const createRes = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        if (createRes.ok) {
            currentUserData = await createRes.json();
            errorEl.classList.remove('show');
            showMainScreen();
            loadChats();
            loadAllUsers();
            initSocket();
        } else {
            const error = await createRes.json();
            showError(errorEl, error.error || 'Failed to create profile');
        }
    } catch (error) {
        console.error('Error:', error);
        showError(errorEl, error.message);
    } finally {
        showLoading(false);
    }
}

async function checkUsernameAvailability() {
    const username = document.getElementById('username').value.trim().toLowerCase();
    const statusEl = document.getElementById('usernameStatus');

    if (!username) {
        statusEl.textContent = '';
        return;
    }

    if (!/^[a-z0-9_]{3,}$/.test(username)) {
        statusEl.textContent = '⚠️ Invalid username';
        statusEl.style.color = '#f02849';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/users/check-username/${username}`);
        const data = await res.json();

        if (data.available) {
            statusEl.textContent = '✅ Available';
            statusEl.style.color = '#31a24c';
        } else {
            statusEl.textContent = '❌ Already taken';
            statusEl.style.color = '#f02849';
        }
    } catch (error) {
        console.error('Error checking username:', error);
    }
}

function previewAvatar() {
    const file = document.getElementById('avatarFile').files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('avatarPreview');
            preview.style.backgroundImage = `url('${e.target.result}')`;
            preview.style.backgroundSize = 'cover';
            preview.innerHTML = '';
        };
        reader.readAsDataURL(file);
    }
}

// ============================================
// DATABASE FUNCTIONS
// ============================================
async function fetchUserData(uid) {
    try {
        const res = await fetch(`${API_URL}/users/${uid}`);
        if (res.ok) {
            return await res.json();
        }
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
            const savedMessage = await res.json();

            if (socket) {
                socket.emit('new_message', savedMessage);
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
            chat.chatType === 'direct' &&
            ((chat.participants[0].userId === currentUser.uid && chat.participants[1].userId === userId) ||
            (chat.participants[0].userId === userId && chat.participants[1].userId === currentUser.uid))
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
            displayChats(allChats);
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
        document.getElementById('noChatSelected').classList.add('hidden');
        document.getElementById('chatWindow').classList.remove('hidden');

        const otherParticipant = chat.participants.find(p => p.userId !== currentUser.uid);
        document.getElementById('chatName').textContent = otherParticipant.name;
        document.getElementById('chatStatus').textContent = `@${otherParticipant.username}`;

        // Update active state
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
        chatsList.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">No chats yet. Start one!</p>';
        return;
    }

    chats.forEach(chat => {
        const otherParticipant = chat.participants.find(p => p.userId !== currentUser.uid);

        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chat._id;

        const lastMessageText = chat.lastMessage?.text?.substring(0, 40) || 'No messages';

        chatItem.innerHTML = `
            <div class="chat-avatar" style="${otherParticipant.avatar ? `background-image: url('${otherParticipant.avatar}'); background-size: cover;` : ''}">
                ${!otherParticipant.avatar ? otherParticipant.name.charAt(0).toUpperCase() : ''}
            </div>
            <div class="chat-info">
                <h3>${otherParticipant.name}</h3>
                <p>@${otherParticipant.username}</p>
                <p style="font-size: 12px; color: var(--text-secondary); margin-top: 3px;">${lastMessageText}</p>
            </div>
        `;

        chatItem.addEventListener('click', () => selectChat(chat._id));
        chatsList.appendChild(chatItem);
    });
}

function displayMessages(messages) {
    const container = document.getElementById('messagesArea');
    container.innerHTML = '';

    messages.forEach((msg) => {
        const isSent = msg.senderId === currentUser.uid;
        const time = new Date(msg.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        const messageGroup = document.createElement('div');
        messageGroup.className = `message-group ${isSent ? 'sent' : 'received'}`;

        let contentHTML = '';

        if (msg.messageType === 'text') {
            contentHTML = `<div class="message-bubble ${isSent ? 'sent' : 'received'}">${escapeHtml(msg.text)}</div>`;
        } else if (msg.messageType === 'photo' || msg.messageType === 'video') {
            contentHTML = `
                <div class="message-media">
                    <${msg.messageType === 'video' ? 'video' : 'img'} src="${msg.media.url}" ${msg.messageType === 'video' ? 'controls' : ''} style="max-width: 300px; border-radius: 12px;">
                </div>
            `;
        }

        const readIcon = isSent ? (msg.readBy?.length > 1 ? '✓✓' : '✓') : '';

        messageGroup.innerHTML = `
            ${!isSent ? `<div class="message-avatar">${msg.senderName.charAt(0).toUpperCase()}</div>` : ''}
            <div>
                ${contentHTML}
                <div class="message-time">${time} ${readIcon}</div>
            </div>
        `;

        container.appendChild(messageGroup);
    });
}

// ============================================
// MODAL FUNCTIONS
// ============================================
function openNewChat() {
    displayUsersList(allUsers);
    openModal('newChatModal');
}

function openSettings() {
    loadSettingsData();
    openModal('settingsModal');
}

function displayUsersList(users) {
    const usersList = document.getElementById('usersSearchResults');
    usersList.innerHTML = '';

    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
            <div class="user-avatar" style="${user.avatar ? `background-image: url('${user.avatar}'); background-size: cover;` : ''}">
                ${!user.avatar ? user.name.charAt(0).toUpperCase() : ''}
            </div>
            <div class="user-info">
                <h3>${user.name}</h3>
                <p>@${user.username}</p>
            </div>
            <button class="btn-small" onclick="createDirectChat('${user.uid}')">Chat</button>
        `;
        usersList.appendChild(userItem);
    });
}

function searchUsers(e) {
    const query = e.target.value.toLowerCase();
    const filtered = allUsers.filter(u =>
        u.name.toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query)
    );
    displayUsersList(filtered);
}

function searchChats(e) {
    const query = e.target.value.toLowerCase();
    const filtered = allChats.filter(chat => {
        const otherUser = chat.participants.find(p => p.userId !== currentUser.uid);
        return otherUser.name.toLowerCase().includes(query) ||
               otherUser.username.toLowerCase().includes(query);
    });
    displayChats(filtered);
}

function loadSettingsData() {
    if (currentUserData) {
        document.getElementById('settingName').value = currentUserData.name;
        document.getElementById('settingUsername').value = `@${currentUserData.username}`;
        document.getElementById('settingEmail').value = currentUserData.email;
        document.getElementById('settingBio').value = currentUserData.bio || '';
        document.getElementById('settingStatus').value = currentUserData.status || '';
    }
}

async function saveSettings() {
    try {
        const bio = document.getElementById('settingBio').value.trim();
        const status = document.getElementById('settingStatus').value.trim();

        const updateRes = await fetch(`${API_URL}/users/${currentUser.uid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bio, status })
        });

        if (updateRes.ok) {
            currentUserData = await updateRes.json();
            closeModal('settingsModal');
            showToast('Settings saved!');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Failed to save settings');
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
                body: JSON.stringify({ isOnline: false, lastSeen: new Date() })
            });

            if (socket) socket.disconnect();
            await auth.signOut();
            window.location.href = '/google-login.html';
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            showLoading(false);
        }
    }
}

function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function switchTab(tab) {
    // Hide all lists
    document.getElementById('chatsList').classList.add('hidden');
    document.getElementById('contactsList').classList.add('hidden');
    document.getElementById('callsList').classList.add('hidden');

    // Remove active from all tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

    // Show selected tab
    if (tab === 'chats') {
        document.getElementById('chatsList').classList.remove('hidden');
    } else if (tab === 'contacts') {
        document.getElementById('contactsList').classList.remove('hidden');
        displayContactsList();
    } else if (tab === 'calls') {
        document.getElementById('callsList').classList.remove('hidden');
    }

    // Mark tab as active
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
}

function displayContactsList() {
    const contactsList = document.getElementById('contactsList');
    contactsList.innerHTML = '';

    allUsers.forEach(user => {
        const contactItem = document.createElement('div');
        contactItem.className = 'contact-item';
        contactItem.innerHTML = `
            <div class="contact-avatar" style="${user.avatar ? `background-image: url('${user.avatar}'); background-size: cover;` : ''}">
                ${!user.avatar ? user.name.charAt(0).toUpperCase() : ''}
            </div>
            <div class="contact-info">
                <h3>${user.name}</h3>
                <p>@${user.username}</p>
            </div>
            <button class="icon-btn" onclick="createDirectChat('${user.uid}')"><i class="fas fa-message"></i></button>
        `;
        contactsList.appendChild(contactItem);
    });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function showAuthScreen() {
    document.getElementById('profileScreen').classList.remove('active');
    document.getElementById('mainScreen').classList.remove('active');
}

function showProfileScreen() {
    document.getElementById('profileScreen').classList.add('active');
    document.getElementById('mainScreen').classList.remove('active');
}

function showMainScreen() {
    document.getElementById('profileScreen').classList.remove('active');
    document.getElementById('mainScreen').classList.add('active');
}

function showLoading(show) {
    document.getElementById('loadingSpinner').classList.toggle('hidden', !show);
}

function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
    setTimeout(() => {
        element.classList.remove('show');
    }, 4000);
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function scrollToBottom() {
    const container = document.getElementById('messagesArea');
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 50);
}

function generateDefaultAvatar(name) {
    // Generate a gradient avatar color based on name
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b', '#fa709a', '#fee140'];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const color = colors[hash % colors.length];
    return color;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function uploadToCloudinary(file) {
    // For now, return a placeholder
    // In production, upload to Cloudinary/AWS S3
    return URL.createObjectURL(file);
}

function toggleDarkMode(e) {
    document.body.classList.toggle('dark-mode', e.target.checked);
    localStorage.setItem('darkMode', e.target.checked);
}

function loadDarkModePreference() {
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        const toggle = document.getElementById('darkModeToggle');
        if (toggle) toggle.checked = true;
    }
}

// ============================================
// SOCKET.IO SETUP
// ============================================
function initSocket() {
    // socket = io('http://localhost:5000');
    // socket.on('connect', () => {
    //     socket.emit('user_online', currentUser.uid);
    // });
    // socket.on('new_message', (message) => {
    //     if (message.chatId === currentChatId) {
    //         loadMessages(currentChatId);
    //     }
    //     loadChats();
    // });
}
