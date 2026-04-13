// ===== FIREBASE CONFIGURATION =====
// PRODUCTION SETUP INSTRUCTIONS:
// 1. Go to https://firebase.google.com and create a free project
// 2. Enable Realtime Database
// 3. Set database rules to:
//    {
//      "rules": {
//        ".read": true,
//        ".write": true
//      }
//    }
// 4. Replace this config with your project's config from Project Settings
// 5. For security in production, implement proper authentication and rules

const firebaseConfig = {
  apiKey: "AIzaSyDWrBVl4RtMoKCSYZWdq4lZqoYMlx9RPCs",
  authDomain: "quizpvp-5a2e2.firebaseapp.com",
  databaseURL: "https://quizpvp-5a2e2-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "quizpvp-5a2e2",
  storageBucket: "quizpvp-5a2e2.firebasestorage.app",
  messagingSenderId: "390766164403",
  appId: "1:390766164403:web:4c143b8b83cf1fa245f3c6",
  measurementId: "G-NFPJFZWKXL"
};

// Initialize Firebase
let database;
let auth;
let connectedRef;
let myConnectionRef;
let isFirebaseReady = false;

try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    auth = firebase.auth();
    connectedRef = database.ref('.info/connected');
    isFirebaseReady = true;
    console.log('✅ Firebase initialized successfully');
    console.log('🌐 Database URL:', firebaseConfig.databaseURL);

    // Test connection
    database.ref('.info/connected').on('value', (snapshot) => {
        if (snapshot.val() === true) {
            console.log('✅ Connected to Firebase!');
        } else {
            console.log('⚠️ Not connected to Firebase');
        }
    });
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
    alert('Failed to connect to game server. Please check:\n1. Your Firebase config in client.js is correct\n2. Your internet connection\n3. Firebase Database is enabled in your project\n\nError: ' + error.message);
    isFirebaseReady = false;
}

// ===== CHAT MESSAGE LIMIT =====
const MAX_CHAT_MESSAGE_LENGTH = 200;

// ===== AI CHAT (ElevenLabs) =====
const AI_DAILY_LIMIT = 5;
const ELEVEN_AGENT_ID = 'agent_0901knykkca9f8qstcr1pk6p2ywx';
let aiWS = null;
let aiConnecting = false;
let aiPendingText = null;

function getAIUsage() {
    try {
        const stored = JSON.parse(localStorage.getItem('aiChatUsage') || 'null');
        const today = new Date().toDateString();
        if (stored && stored.date === today) return stored;
    } catch(e) {}
    return { date: new Date().toDateString(), count: 0 };
}

function saveAIUsage(usage) {
    localStorage.setItem('aiChatUsage', JSON.stringify(usage));
}

function getAIMsgsRemaining() {
    return Math.max(0, AI_DAILY_LIMIT - getAIUsage().count);
}

async function updateAIChatUI() {
    const { total, blocked, bonusLeft } = await getTotalAIMsgsRemaining();
    const msgsLeft = document.getElementById('aiMsgsLeft');
    const limitBar = document.getElementById('aiLimitBar');
    const inputArea = document.getElementById('aiInputArea');
    const sendBtn = document.getElementById('aiSendBtn');
    const input = document.getElementById('aiMsgInput');

    if (msgsLeft) msgsLeft.textContent = total;

    // Show a ☕ badge when user is running on purchased bonus messages
    const badge = document.getElementById('aiMsgsLeft')?.closest('.ai-msgs-badge');
    if (badge) badge.title = bonusLeft > 0 ? `${bonusLeft} purchased messages remaining` : '';

    if (total <= 0 || blocked) {
        if (limitBar) limitBar.style.display = 'flex';
        if (inputArea) inputArea.style.opacity = '0.5';
        if (sendBtn) sendBtn.disabled = true;
        if (input) { input.disabled = true; input.placeholder = 'Limit reached'; }
    } else {
        if (limitBar) limitBar.style.display = 'none';
        if (inputArea) inputArea.style.opacity = '1';
        if (sendBtn) sendBtn.disabled = false;
        if (input) { input.disabled = false; input.placeholder = 'Type a message...'; }
    }
}

function setAIChatStatus(text) {
    const el = document.getElementById('aiChatStatus');
    if (el) el.textContent = text;
}

function parseAIText(text) {
    // Safely converts **bold** and URLs into DOM nodes — no innerHTML used
    const fragment = document.createDocumentFragment();
    const pattern = /(\*\*(.+?)\*\*|https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        if (match[0].startsWith('**')) {
            const strong = document.createElement('strong');
            strong.textContent = match[2];
            fragment.appendChild(strong);
        } else {
            const a = document.createElement('a');
            a.href = match[0];
            a.textContent = match[0];
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = 'ai-link';
            fragment.appendChild(a);
        }
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    return fragment;
}

function appendAIMessage(text, isUser) {
    const list = document.getElementById('aiMessagesList');
    if (!list) return;
    const msg = document.createElement('div');
    msg.className = `chat-message ${isUser ? 'mine' : 'theirs'}`;
    const bubble = document.createElement('div');
    bubble.className = 'message-text';
    if (isUser) {
        bubble.textContent = text;
    } else {
        bubble.appendChild(parseAIText(text));
    }
    msg.appendChild(bubble);
    list.appendChild(msg);
    list.scrollTop = list.scrollHeight;
}

function handleAIWSMessage(event) {
    try {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'agent_response': {
                const text = data.agent_response_event && data.agent_response_event.agent_response;
                if (text) {
                    appendAIMessage(text, false);
                    setAIChatStatus('● Ready');
                }
                break;
            }
            case 'ping':
                if (aiWS && aiWS.readyState === WebSocket.OPEN) {
                    aiWS.send(JSON.stringify({ type: 'pong', event_id: data.ping_event.event_id }));
                }
                break;
            case 'conversation_initiation_metadata':
                setAIChatStatus('● Connected');
                if (aiPendingText) {
                    const txt = aiPendingText;
                    aiPendingText = null;
                    sendTextToAIAgent(txt);
                }
                break;
        }
    } catch(e) {
        console.warn('AI WS parse error:', e);
    }
}

function sendTextToAIAgent(text) {
    if (!aiWS || aiWS.readyState !== WebSocket.OPEN) return;
    aiWS.send(JSON.stringify({ type: 'user_message', text: text }));
    setAIChatStatus('● Thinking...');
}

function connectAIAndSend(text) {
    if (aiWS && aiWS.readyState === WebSocket.OPEN) {
        sendTextToAIAgent(text);
        return;
    }
    if (aiConnecting) {
        aiPendingText = text;
        return;
    }
    aiConnecting = true;
    aiPendingText = text;
    setAIChatStatus('● Connecting...');

    const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${ELEVEN_AGENT_ID}`;
    try {
        aiWS = new WebSocket(wsUrl);
    } catch(e) {
        aiConnecting = false;
        aiPendingText = null;
        setAIChatStatus('● Error');
        appendAIMessage('Could not connect. Please try again.', false);
        return;
    }

    aiWS.onopen = function() {
        aiConnecting = false;
        aiWS.send(JSON.stringify({ type: 'conversation_initiation_client_data' }));
    };
    aiWS.onmessage = handleAIWSMessage;
    aiWS.onclose = function() {
        aiWS = null;
        aiConnecting = false;
        setAIChatStatus('● Ready');
    };
    aiWS.onerror = function() {
        aiWS = null;
        aiConnecting = false;
        aiPendingText = null;
        setAIChatStatus('● Error — try again');
        appendAIMessage('Connection failed. Please check your internet and try again.', false);
    };
}

async function sendAIMessage() {
    const input = document.getElementById('aiMsgInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    // Disable button immediately to prevent double-sends while we check
    const sendBtn = document.getElementById('aiSendBtn');
    if (sendBtn) sendBtn.disabled = true;

    const usage = await getAllAIUsage();

    if (usage.blocked) {
        appendAIMessage('⚠️ Could not connect to the server. Please check your internet and try again.', false);
        if (sendBtn) sendBtn.disabled = false;
        return;
    }

    const dailyLeft = Math.max(0, AI_DAILY_LIMIT - usage.accountCount);

    if (dailyLeft <= 0) {
        // Daily limit hit — check if user has purchased bonus messages
        const bonusLeft = await getBonusRemaining();
        if (bonusLeft <= 0) {
            updateAIChatUI();
            return;
        }
        // Use a bonus message
        appendAIMessage(text, true);
        input.value = '';
        await deductBonusMessage();
        updateAIChatUI();
        connectAIAndSend(text);
        return;
    }

    // Normal daily message — write all three tracking layers
    appendAIMessage(text, true);
    input.value = '';
    await saveAllAIUsage(usage);
    updateAIChatUI();
    connectAIAndSend(text);
}

function initAIChat() {
    // Block AI chat for guest (anonymous) users
    if (typeof auth !== 'undefined' && auth && auth.currentUser && auth.currentUser.isAnonymous) {
        const list = document.getElementById('aiMessagesList');
        if (list) {
            list.textContent = '';
            const lock = document.createElement('div');
            lock.className = 'ai-guest-lock';
            const icon = document.createElement('div');
            icon.className = 'ai-guest-lock-icon';
            icon.textContent = '🔒';
            const text = document.createElement('p');
            text.textContent = 'AI Chat is not available in Guest mode. Create a free account to unlock it.';
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary btn-small';
            btn.textContent = 'Create a free account';
            btn.addEventListener('click', signOutUser);
            lock.appendChild(icon);
            lock.appendChild(text);
            lock.appendChild(btn);
            list.appendChild(lock);
        }
        const inputArea = document.getElementById('aiInputArea');
        if (inputArea) inputArea.style.display = 'none';
        const topBar = document.querySelector('.ai-msgs-badge');
        if (topBar) topBar.style.display = 'none';
        return;
    }

    // Restore input area in case it was hidden for a previous guest session
    const inputArea = document.getElementById('aiInputArea');
    if (inputArea) inputArea.style.display = '';
    const topBar = document.querySelector('.ai-msgs-badge');
    if (topBar) topBar.style.display = '';

    getAccountAIUsage(); // pre-warm account usage so first send is instant
    updateAIChatUI();

    const sendBtn = document.getElementById('aiSendBtn');
    const input = document.getElementById('aiMsgInput');

    if (sendBtn && !sendBtn._aiListenerAttached) {
        sendBtn.addEventListener('click', sendAIMessage);
        sendBtn._aiListenerAttached = true;
    }
    if (input && !input._aiListenerAttached) {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') sendAIMessage();
        });
        input._aiListenerAttached = true;
    }
}

// ===== ANTI-ABUSE SYSTEM =====

// --- 1. Incognito / Private Browsing Detection ---
async function detectPrivateBrowsing() {
    try {
        if (navigator.storage && navigator.storage.estimate) {
            const { quota } = await navigator.storage.estimate();
            // Incognito gives a very small quota (< 500 MB); normal mode gives several GB
            if (quota && quota < 500 * 1024 * 1024) return true;
        }
    } catch(e) {}
    return false;
}

function showPrivateBrowsingWarning() {
    // Auth-based system means incognito detection is no longer used for blocking
    // Users must sign in regardless — private browsing doesn't bypass email auth
    console.log('ℹ️ Private browsing detected, but auth-based login is still required.');
}

// --- 2. Multiple Tab Detection ---
let isMainTab = false;
let tabCheckDone = false;
const tabChannel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('quizpvp_tab_guard') : null;

function setupTabDetection() {
    if (!tabChannel) { isMainTab = true; tabCheckDone = true; return; }

    tabChannel.onmessage = function(e) {
        if (e.data === 'PING') {
            // Another tab just opened — tell it we exist
            tabChannel.postMessage('PONG');
        } else if (e.data === 'PONG' && !tabCheckDone) {
            // Got a reply — a tab was already open, block this one
            tabCheckDone = true;
            isMainTab = false;
            document.getElementById('duplicateTabOverlay').style.display = 'flex';
        } else if (e.data === 'CLOSE' && !isMainTab) {
            // The main tab closed — let this one take over
            isMainTab = true;
            document.getElementById('duplicateTabOverlay').style.display = 'none';
        }
    };

    // Broadcast our presence; if nobody answers within 600ms we're the only tab
    tabChannel.postMessage('PING');
    setTimeout(function() {
        if (!tabCheckDone) { tabCheckDone = true; isMainTab = true; }
    }, 600);

    window.addEventListener('beforeunload', function() {
        tabChannel.postMessage('CLOSE');
    });
}

// --- 3. Account-Based AI Rate Limiting ---
// The limit is tied to the Firebase Auth UID.
// VPN, new device, incognito — nothing bypasses it since UID is permanent per account.

function _getAIUserId() {
    if (typeof auth !== 'undefined' && auth && auth.currentUser) return auth.currentUser.uid;
    return null;
}

async function getAccountAIUsage() {
    const today = new Date().toDateString();
    if (!isFirebaseReady) return { today, count: AI_DAILY_LIMIT, blocked: true };
    const uid = _getAIUserId();
    if (!uid) return { today, count: 0 };
    // Block AI chat for guest (anonymous) users
    if (auth.currentUser.isAnonymous) return { today, count: AI_DAILY_LIMIT, blocked: true, isGuest: true };
    try {
        const snap = await database.ref('accountAiUsage/' + uid).once('value');
        const d = snap.val();
        if (d && d.date === today) return { today, count: d.count || 0 };
    } catch(e) {}
    return { today, count: 0 };
}

async function saveAccountAIUsage(usage) {
    if (!isFirebaseReady) return;
    const uid = _getAIUserId();
    if (!uid) return;
    try {
        await database.ref('accountAiUsage/' + uid).set({ date: usage.today, count: usage.count + 1 });
    } catch(e) {}
}

// Keep getAllAIUsage/saveAllAIUsage as thin wrappers so sendAIMessage doesn't need changes
async function getAllAIUsage() {
    const u = await getAccountAIUsage();
    return { today: u.today, deviceCount: 0, accountCount: u.count, ipCount: 0, blocked: u.blocked || false, _raw: u };
}

async function saveAllAIUsage(usage) {
    await saveAccountAIUsage(usage._raw || { today: usage.today, count: usage.accountCount });
}

// --- 4. Purchased Bonus Messages ---
// Admin flow: after a Ko-fi purchase, go to Firebase console →
// aiChatBonus/{username} → set { remaining: 15 }
// The client reads this and adds it on top of the daily limit.

async function getBonusRemaining() {
    const uid = _getAIUserId();
    if (!uid || !isFirebaseReady) return 0;
    try {
        const snap = await database.ref('aiChatBonus/' + uid).once('value');
        const d = snap.val();
        return (d && typeof d.remaining === 'number') ? Math.max(0, d.remaining) : 0;
    } catch(e) { return 0; }
}

async function deductBonusMessage() {
    const uid = _getAIUserId();
    if (!uid || !isFirebaseReady) return;
    try {
        const snap = await database.ref('aiChatBonus/' + uid).once('value');
        const d = snap.val();
        if (d && d.remaining > 0) {
            await database.ref('aiChatBonus/' + uid).set({ remaining: d.remaining - 1 });
        }
    } catch(e) {}
}

async function getTotalAIMsgsRemaining() {
    const usage = await getAllAIUsage();
    if (usage.blocked) return { total: 0, blocked: true, dailyLeft: 0, bonusLeft: 0, usage };
    const dailyLeft = Math.max(0, AI_DAILY_LIMIT - usage.accountCount);
    const bonusLeft = dailyLeft > 0 ? 0 : await getBonusRemaining();
    return { total: dailyLeft + bonusLeft, blocked: false, dailyLeft, bonusLeft, usage };
}

// ===== FIREBASE AUTH SYSTEM =====

// Called by onAuthStateChanged whenever auth state changes
async function handleAuthStateChange(user) {
    if (!user) {
        // Signed out — reset state and show auth screen
        playerData.username = '';
        playerData.uid = '';
        playerData.id = '';
        showScreen('authScreen');
        return;
    }

    // Anonymous/guest: if session is already set, sign them out on reload
    // (SESSION persistence means they disappear when the tab closes,
    //  but onAuthStateChanged might still fire within the same session)
    if (user.isAnonymous) {
        // Guest is valid for this session — load their data
        await loadPlayerDataForUser(user);
        return;
    }

    if (!user.emailVerified) {
        // Registered via email but not yet verified
        showScreen('emailVerifyScreen');
        return;
    }

    // Fully authenticated — load their data
    await loadPlayerDataForUser(user);
}

// Load player data from Firebase for a given auth user
async function loadPlayerDataForUser(user) {
    try {
        const snap = await database.ref('users/' + user.uid).once('value');
        const d = snap.val() || {};

        playerData.uid = user.uid;
        playerData.id = user.uid;
        playerData.username = d.username || '';
        playerData.points = d.points || 0;
        playerData.color = d.color || '#4A90E2';
        playerData.friends = d.friends || [];
        playerData.friendRequests = d.friendRequests || [];
        playerData.level = d.level || 1;
        playerData.xp = d.xp || 0;
        playerData.wins = d.wins || 0;
        playerData.ownedCosmetics = d.ownedCosmetics || [];
        playerData.equippedCosmetic = d.equippedCosmetic || null;

        if (!playerData.username) {
            // No username — sign out and return to auth screen
            await auth.signOut();
            return;
        }

        setupAfterLogin(user.isAnonymous);
    } catch (e) {
        console.error('Error loading player data:', e);
        showScreen('authScreen');
    }
}

// Run after a successful login or guest sign-in
function setupAfterLogin(isGuest) {
    updatePlayerDisplay();

    // Show / hide guest badge
    const guestBadge = document.getElementById('guestBadge');
    if (guestBadge) guestBadge.style.display = isGuest ? 'flex' : 'none';

    showScreen('menuScreen');
    setupPlayerPresence();
    trackActivePlayerCount();
    trackModePlayerCounts();
    trackRPSModePlayerCounts();
    trackWarModePlayerCounts();
    setupGameInviteListener();
    setupFriendRequestListener();
    loadFriendsList();
    loadFriendRequests();
    cleanupOldGames();
    setInterval(cleanupOldGames, 60000);
}

// Register a new account with email + password + username
async function registerWithEmail(username, email, password) {
    const errorEl = document.getElementById('registerError');
    const btn = document.getElementById('registerSubmitBtn');

    if (errorEl) errorEl.style.display = 'none';
    if (btn) { btn.disabled = true; btn.textContent = 'Creating account...'; }

    try {
        if (username.length < 2) throw { message: 'Username must be at least 2 characters.' };
        if (!/^[a-zA-Z0-9_]+$/.test(username)) throw { message: 'Username can only contain letters, numbers and underscores.' };

        const taken = await isUsernameTaken(username);
        if (taken) throw { message: 'That username is already taken. Please choose another.' };

        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const uid = cred.user.uid;

        // Save username and profile to Firebase
        await database.ref('users/' + uid).set({
            username: username,
            email: email,
            points: 0,
            color: '#4A90E2',
            friends: [],
            friendRequests: [],
            level: 1,
            xp: 0,
            wins: 0,
            ownedCosmetics: [],
            equippedCosmetic: null,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        await database.ref('usernames/' + uid).set(username);

        // Send verification email
        await cred.user.sendEmailVerification();

        // Show email verification screen and start resend countdown
        showScreen('emailVerifyScreen');
        const verifyText = document.getElementById('verifyEmailText');
        if (verifyText) verifyText.textContent = 'We sent a verification link to ' + email + '. Click it, then press "Continue".';
        startResendCountdown();

    } catch (e) {
        const msg = e.code === 'auth/email-already-in-use'
            ? 'That email is already registered. Try logging in instead.'
            : e.code === 'auth/invalid-email'
            ? 'Please enter a valid email address.'
            : e.code === 'auth/weak-password'
            ? 'Password must be at least 6 characters.'
            : e.message || 'Registration failed. Please try again.';
        if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }
    }
}

// Sign in with email + password
async function loginWithEmail(email, password) {
    const errorEl = document.getElementById('loginError');
    const btn = document.getElementById('loginSubmitBtn');

    if (errorEl) errorEl.style.display = 'none';
    if (btn) { btn.disabled = true; btn.textContent = 'Logging in...'; }

    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        await auth.signInWithEmailAndPassword(email, password);
        // onAuthStateChanged fires and calls handleAuthStateChange
        if (btn) { btn.disabled = false; btn.textContent = 'Log In'; }
    } catch (e) {
        const msg = e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential'
            ? 'Incorrect email or password.'
            : e.code === 'auth/invalid-email'
            ? 'Please enter a valid email address.'
            : e.code === 'auth/too-many-requests'
            ? 'Too many attempts. Please wait a moment and try again.'
            : e.message || 'Login failed. Please try again.';
        if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Log In'; }
    }
}

// Sign in anonymously — username auto-assigned as GUESTPLAYER + random suffix
async function signInAsGuest() {
    const btn = document.getElementById('authGuestBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Joining...'; }

    try {
        // Use SESSION persistence so guest data clears when the browser tab is closed
        await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

        const cred = await auth.signInAnonymously();
        const uid = cred.user.uid;

        // Auto-assign a unique guest username
        const suffix = Math.floor(1000 + Math.random() * 9000);
        const username = 'GUESTPLAYER' + suffix;

        // Save guest profile
        await database.ref('users/' + uid).set({
            username: username,
            points: 0,
            color: '#4A90E2',
            friends: [],
            friendRequests: [],
            level: 1,
            xp: 0,
            wins: 0,
            ownedCosmetics: [],
            equippedCosmetic: null,
            isGuest: true,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        await database.ref('usernames/' + uid).set(username);

        // onAuthStateChanged fires and calls handleAuthStateChange
    } catch (e) {
        console.error('Guest sign-in error:', e);
        const msg = e.code === 'auth/operation-not-allowed'
            ? 'Guest sign-in is not enabled yet. Please create a free account.'
            : 'Could not sign in as guest. Check your internet connection.';
        alert(msg);
        if (btn) { btn.disabled = false; btn.textContent = 'Play as Guest'; }
    }
}


// Sign out the current user
async function signOutUser() {
    try {
        // Remove from online presence
        if (myConnectionRef) {
            await myConnectionRef.remove().catch(() => {});
            myConnectionRef = null;
        }
        await auth.signOut();
        localStorage.removeItem('quizpvp_player');
        // onAuthStateChanged fires with null → shows authScreen
    } catch (e) {
        console.error('Sign out error:', e);
    }
}

// Called when user clicks "I've verified — Continue"
async function checkEmailVerification() {
    const btn = document.getElementById('verifyCheckBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Checking...'; }

    try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
            await loadPlayerDataForUser(auth.currentUser);
        } else {
            alert('Email not verified yet. Please click the link in your inbox first.');
        }
    } catch (e) {
        console.error('Verify check error:', e);
        alert('Could not check verification status. Please try again.');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "I've verified — Continue"; }
    }
}

// Resend email with 60-second countdown
let resendCountdownTimer = null;

function startResendCountdown() {
    const btn = document.getElementById('resendVerifyBtn');
    if (!btn) return;
    let secs = 60;
    btn.disabled = true;
    btn.textContent = `Resend Email (${secs}s)`;
    clearInterval(resendCountdownTimer);
    resendCountdownTimer = setInterval(() => {
        secs--;
        if (secs <= 0) {
            clearInterval(resendCountdownTimer);
            btn.disabled = false;
            btn.textContent = 'Resend Email';
        } else {
            btn.textContent = `Resend Email (${secs}s)`;
        }
    }, 1000);
}

async function resendVerificationEmail() {
    const btn = document.getElementById('resendVerifyBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

    try {
        await auth.currentUser.sendEmailVerification();
        startResendCountdown();
    } catch (e) {
        alert('Could not send email. Please wait a moment and try again.');
        if (btn) { btn.disabled = false; btn.textContent = 'Resend Email'; }
    }
}


// ===== GLOBAL NAVIGATION SYSTEM =====
// This navigation system uses direct DOM manipulation and is guaranteed to work
window.gameNavigation = {
    // Switch screens
    showScreen: function(screenId) {
        console.log(`🔄 Navigation: Switching to ${screenId}`);

        try {
            // Hide all screens
            const allScreens = document.querySelectorAll('.screen');
            allScreens.forEach(screen => {
                screen.classList.remove('active');
            });

            // Show target screen
            const targetScreen = document.getElementById(screenId);
            if (targetScreen) {
                targetScreen.classList.add('active');
                console.log(`✅ Navigation: Now showing ${screenId}`);

                // Render shop when opening shop screen
                if (screenId === 'shopScreen') {
                    if (typeof renderShop === 'function') {
                        renderShop();
                    } else {
                        console.error('❌ renderShop function not found!');
                    }
                }

                return true;
            } else {
                console.error(`❌ Navigation: Screen ${screenId} not found`);
                return false;
            }
        } catch (error) {
            console.error(`❌ Navigation error:`, error);
            return false;
        }
    },

    // Hub navigation functions
    goToPlay: function() {
        console.log('🎮 Play button clicked!');
        this.showScreen('playScreen');
    },

    goToSocial: function() {
        console.log('💬 Social button clicked!');
        this.showScreen('socialScreen');
        // Load friends data if functions exist
        if (typeof loadFriendsList === 'function') loadFriendsList();
        if (typeof loadFriendRequests === 'function') loadFriendRequests();
        if (typeof initAIChat === 'function') initAIChat();
    },

    goToSettings: function() {
        console.log('⚙️ Settings button clicked!');
        this.showScreen('settingsScreen');
    },

    goToMenu: function() {
        console.log('🏠 Going to menu');
        this.showScreen('menuScreen');
    },

    goToMathMode: function() {
        console.log('➕ Math mode selected');
        this.showScreen('mathModeScreen');
    }
};

// Make navigation functions available globally for inline onclick
window.showScreen = window.gameNavigation.showScreen.bind(window.gameNavigation);

console.log('✅ Global navigation system initialized');

// ===== v1.5 FEATURES =====

// In-App Notification System
window.showNotification = function(title, message, icon = '✨') {
    const notification = document.getElementById('appNotification');
    if (!notification) return;

    const titleEl = notification.querySelector('.notification-title');
    const messageEl = notification.querySelector('.notification-message');
    const iconEl = notification.querySelector('.notification-icon');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (iconEl) iconEl.textContent = icon;

    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
    }, 4000);
};

// Anti-Tab-Switch Detection (Auto-lose if you leave during game)
let gameWindowFocused = true;
let antiCheatActive = false;

window.addEventListener('blur', () => {
    gameWindowFocused = false;

    // Only trigger anti-cheat if actively playing AND on game screen
    const gameScreen = document.getElementById('gameScreen');
    const isOnGameScreen = gameScreen && gameScreen.classList.contains('active');

    if (antiCheatActive && currentGame.gameId && isOnGameScreen) {
        console.log('⚠️ Player left game window during active match - triggering auto-loss');
        handleTabSwitchLoss();
    }
});

window.addEventListener('focus', () => {
    gameWindowFocused = true;
});

function handleTabSwitchLoss() {
    if (!currentGame.gameId) return;

    showNotification('Auto-Loss', 'You left the game window!', '❌');

    // Mark player as lost
    setTimeout(() => {
        const myScore = currentGame.answers.reduce((sum, a) => sum + (a.correct ? 10 : 0), 0);
        database.ref(`games/${currentGame.gameId}/players/${playerData.id}/score`).set(Math.floor(myScore / 2)); // Half points penalty
        database.ref(`games/${currentGame.gameId}/players/${playerData.id}/finished`).set(true);
        database.ref(`games/${currentGame.gameId}/players/${playerData.id}/tabSwitch`).set(true);

        showScreen('menuScreen');
        alert('You lost because you left the game window!');
    }, 500);
}

// v1.5 - Track player count per mode
function trackModePlayerCounts() {
    if (!database) return;

    // Track 1v1 players
    database.ref('waiting_1v1').on('value', (snapshot) => {
        const count = snapshot.numChildren();
        const el = document.getElementById('count1v1');
        if (el) el.textContent = count;
    });

    // Track 1v2 players
    database.ref('waiting_trios').on('value', (snapshot) => {
        const count = snapshot.numChildren();
        const el = document.getElementById('count1v2');
        if (el) el.textContent = count;
    });

    // Track 1v3 players
    database.ref('waiting_squad').on('value', (snapshot) => {
        const count = snapshot.numChildren();
        const el = document.getElementById('count1v3');
        if (el) el.textContent = count;
    });

    console.log('✅ Mode player count tracking initialized');
}

console.log('✅ v1.5 features initialized');

// v1.5: Level system - Calculate XP required for next level
function getXPForLevel(level) {
    // Exponential progression: level 1->2 needs 100 XP, level 2->3 needs 150 XP, etc.
    return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Get level tier for styling
function getLevelTier(level) {
    if (level >= 50) return 'legendary';
    if (level >= 30) return 'epic';
    if (level >= 20) return 'rare';
    if (level >= 10) return 'uncommon';
    return 'common';
}

// Get level display with styling
function getLevelDisplay(level) {
    const tier = getLevelTier(level);
    return `<span class="player-level level-${tier}">Lv ${level}</span>`;
}

// Award XP and check for level up
function awardXP(amount) {
    playerData.xp += amount;
    console.log(`✨ +${amount} XP! Total: ${playerData.xp}`);

    // Check for level up
    let leveledUp = false;
    while (playerData.xp >= getXPForLevel(playerData.level)) {
        playerData.xp -= getXPForLevel(playerData.level);
        playerData.level++;
        leveledUp = true;
        console.log(`🎉 LEVEL UP! Now level ${playerData.level}`);
    }

    if (leveledUp) {
        showNotification('Level Up!', `You are now level ${playerData.level}!`, '🎉');
    }

    savePlayerData();
    updatePlayerDisplay();
}

let playerData = {
    username: '',
    points: 0,
    color: '#4A90E2',
    id: '',
    friends: [],
    friendRequests: [],
    level: 1,
    xp: 0,
    wins: 0, // Track total wins for cosmetic unlocks
    ownedCosmetics: [], // Array of owned cosmetic IDs
    equippedCosmetic: null // Currently equipped cosmetic ID
};

let currentGame = {
    gameId: '',
    questions: [],
    answers: [],
    currentQuestionIndex: 0,
    opponent: '',
    opponentColor: '',
    opponentUsername: '',
    mode: '1v1', // '1v1' or 'squad'
    players: [], // For squad mode
    gameStartedAt: 0 // Server timestamp when game started
};

let gameListener = null;
let searchListener = null;
let activePlayersCount = 0;
let currentMode = '1v1'; // Default mode
let resultsReadyToView = false;
let myGameScore = 0;
let opponentGameScore = 0;
let gameWon = false;
let gameDraw = false;

let gameTimer = null;
let timeRemaining = 80; // 1 minute 20 seconds

// ===== WHO AM I GAME VARIABLES =====
let whoAmIWords = [];
let whoAmICurrentWordIndex = 0;
let whoAmICorrect = 0;
let whoAmIWrong = 0;
let whoAmITimer = null;
let orientationListener = null;
let isMobile = false;

// ===== CHAT MODE VARIABLES =====
let currentChatSession = {
    chatId: '',
    partnerId: '',
    partnerUsername: '',
    partnerColor: '',
    partnerLevel: 1
};
let chatListener = null;
let chatSearchListener = null;

// v1.5 - Track search type for proper cancel navigation
let currentSearchType = 'game'; // 'game' or 'chat'

// ===== PLAYER PRESENCE & ACTIVE COUNT SYSTEM =====

// Setup player presence tracking
function setupPlayerPresence() {
    if (!database || !playerData.id) return;

    // Reference to online players (playerData.id === auth UID after login)
    const onlineRef = database.ref('online/' + playerData.id);

    // Monitor connection status
    connectedRef.on('value', (snapshot) => {
        if (snapshot.val() === true) {
            console.log('🌐 Connected to server');

            // When connected, add to online players
            onlineRef.set({
                username: playerData.username,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                status: 'online'
            });

            // Remove from online list when disconnected
            onlineRef.onDisconnect().remove();

            myConnectionRef = onlineRef;
        } else {
            console.log('📴 Disconnected from server');
        }
    });

    // Update connection status display
    updateConnectionStatus(true);
}

// Track active player count
function trackActivePlayerCount() {
    const onlineRef = database.ref('online');

    onlineRef.on('value', (snapshot) => {
        const online = snapshot.val() || {};
        activePlayersCount = Object.keys(online).length;

        console.log('👥 Active players:', activePlayersCount);
        updatePlayerCountDisplay();
    });
}

// Update player count display
function updatePlayerCountDisplay() {
    const countElement = document.getElementById('activePlayerCount');
    if (countElement) {
        countElement.textContent = activePlayersCount;

        // Add animation when count changes
        countElement.classList.add('pulse');
        setTimeout(() => countElement.classList.remove('pulse'), 300);
    }
}

// Update connection status indicator
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.className = connected ? 'connection-status connected' : 'connection-status disconnected';
        statusElement.textContent = connected ? '● Online' : '● Offline';
    }
}

// Clean up old games (older than 5 minutes)
function cleanupOldGames() {
    const gamesRef = database.ref('games');
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

    gamesRef.once('value', (snapshot) => {
        const games = snapshot.val() || {};
        Object.keys(games).forEach(gameId => {
            const game = games[gameId];
            if (game.createdAt < fiveMinutesAgo) {
                console.log('🗑️ Cleaning up old game:', gameId);
                gamesRef.child(gameId).remove();
            }
        });
    });
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Generate random math questions
function generateQuestion() {
    const operations = ['+', '-', '*'];
    const operation = operations[Math.floor(Math.random() * operations.length)];

    let num1, num2, answer;

    switch(operation) {
        case '+':
            num1 = Math.floor(Math.random() * 50) + 1;
            num2 = Math.floor(Math.random() * 50) + 1;
            answer = num1 + num2;
            break;
        case '-':
            num1 = Math.floor(Math.random() * 50) + 25;
            num2 = Math.floor(Math.random() * 25) + 1;
            answer = num1 - num2;
            break;
        case '*':
            num1 = Math.floor(Math.random() * 12) + 1;
            num2 = Math.floor(Math.random() * 12) + 1;
            answer = num1 * num2;
            break;
    }

    return {
        question: `${num1} ${operation} ${num2}`,
        answer: answer
    };
}

// Generate quiz
function generateQuiz() {
    const questions = [];
    for (let i = 0; i < 8; i++) {
        questions.push(generateQuestion());
    }
    return questions;
}

// ===== WHO AM I WORD BANK =====
const whoAmIWordBank = [
    'DOG', 'CAT', 'PIZZA', 'BATMAN', 'DOCTOR', 'TEACHER', 'SINGER', 'SOCCER', 'NINJA', 'PIRATE',
    'ASTRONAUT', 'CHEF', 'PILOT', 'MUSICIAN', 'DANCER', 'ACTOR', 'PRESIDENT', 'SUPERHERO', 'ROBOT', 'ZOMBIE',
    'VAMPIRE', 'WIZARD', 'PRINCESS', 'KING', 'QUEEN', 'KNIGHT', 'DRAGON', 'UNICORN', 'MERMAID', 'ALIEN',
    'COWBOY', 'DETECTIVE', 'SPY', 'ATHLETE', 'FIREFIGHTER', 'POLICE', 'SOLDIER', 'NURSE', 'SCIENTIST', 'ARTIST',
    'PHOTOGRAPHER', 'WRITER', 'MAGICIAN', 'CLOWN', 'FARMER', 'CARPENTER', 'MECHANIC', 'BARBER', 'FISHERMAN', 'HUNTER'
];

// Generate Who Am I words
function generateWhoAmIWords() {
    const shuffled = [...whoAmIWordBank].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 10);
}

// Screen management
function showScreen(screenId) {
    console.log(`🔄 Switching to screen: ${screenId}`);

    // Remove active class from all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    // Add active class to target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        console.log(`✅ Screen switched to: ${screenId}`);

        // Render shop when opening shop screen
        if (screenId === 'shopScreen') {
            renderShop();
        }
    } else {
        console.error(`❌ Screen not found: ${screenId}`);
    }
}

// Check if username is taken
async function isUsernameTaken(username) {
    try {
        const snapshot = await database.ref('usernames').orderByValue().equalTo(username).once('value');
        return snapshot.exists();
    } catch (error) {
        console.error('Error checking username:', error);
        return false;
    }
}

// Register username
async function registerUsername(username, userId) {
    try {
        await database.ref(`usernames/${userId}`).set(username);
        console.log('✅ Username registered:', username);
    } catch (error) {
        console.error('Error registering username:', error);
    }
}

// Load player data — now handled by Firebase Auth (onAuthStateChanged → loadPlayerDataForUser)
// Kept as stub for any remaining callers
async function loadPlayerData() {
    // Auth-driven — onAuthStateChanged handles loading
    return false;
}

// Save player data to localStorage and Firebase
function savePlayerData() {
    localStorage.setItem('quizpvp_player', JSON.stringify({
        points: playerData.points,
        color: playerData.color,
        id: playerData.id,
        username: playerData.username,
        friends: playerData.friends || [],
        friendRequests: playerData.friendRequests || [],
        level: playerData.level || 1,
        xp: playerData.xp || 0,
        wins: playerData.wins || 0,
        ownedCosmetics: playerData.ownedCosmetics || [],
        equippedCosmetic: playerData.equippedCosmetic || null
    }));

    // Also persist to Firebase so data is tied to the account, not the device
    if (isFirebaseReady && typeof auth !== 'undefined' && auth && auth.currentUser) {
        database.ref('users/' + auth.currentUser.uid).update({
            points: playerData.points,
            color: playerData.color,
            level: playerData.level || 1,
            xp: playerData.xp || 0,
            wins: playerData.wins || 0,
            ownedCosmetics: playerData.ownedCosmetics || [],
            equippedCosmetic: playerData.equippedCosmetic || null,
            friends: playerData.friends || [],
            friendRequests: playerData.friendRequests || []
        }).catch(e => console.warn('Firebase savePlayerData failed:', e));
    }
}

// Update player display
function updatePlayerDisplay() {
    const nameDisplay = document.getElementById('playerNameDisplay');
    const pointsDisplay = document.getElementById('pointsDisplay');
    const shopPointsDisplay = document.getElementById('shopPointsDisplay');

    nameDisplay.textContent = playerData.username;
    nameDisplay.style.background = getColorStyle(playerData.color);
    nameDisplay.style.color = isLightColor(playerData.color) ? '#333' : 'white';

    pointsDisplay.textContent = playerData.points.toLocaleString();
    shopPointsDisplay.textContent = playerData.points.toLocaleString();
}

// Get color style
function getColorStyle(color) {
    if (color === 'rainbow') {
        return 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #8b00ff)';
    } else if (color === 'gold') {
        return 'linear-gradient(135deg, #FFD700, #FFA500)';
    } else {
        return color;
    }
}

// Check if color is light
function isLightColor(color) {
    if (color === 'rainbow' || color === 'gold') return false;

    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155;
}

// Apply avatar style
function applyAvatarStyle(element, color) {
    element.style.background = getColorStyle(color);

    if (color === 'rainbow') {
        element.classList.add('rainbow-avatar');
    } else if (color === 'gold') {
        element.classList.add('gold-avatar');
    }
}

// Find match (supports both 1v1 and squad modes)
async function findMatch() {
    console.log(`🔍 Starting ${currentMode} matchmaking for player:`, playerData.username);

    // Track that we're searching for game (for cancel button)
    currentSearchType = 'game';

    // Check if Firebase is ready
    if (!isFirebaseReady || !database) {
        alert('⚠️ Firebase is not connected!\n\nPlease check:\n1. You updated the Firebase config in client.js\n2. Your Firebase Realtime Database is enabled\n3. Database rules are set to allow read/write\n\nOpen browser console (F12) for more details.');
        console.error('❌ Firebase not ready. Cannot start matchmaking.');
        showScreen('menuScreen');
        return;
    }

    // Handle Who Am I mode separately (no matchmaking needed)
    if (currentMode === 'whoami') {
        startWhoAmIGame();
        return;
    }

    // Handle Chat mode
    if (currentMode === 'chat') {
        await findChatPartner();
        return;
    }

    showScreen('searchingScreen');

    // Route to correct matchmaking based on mode
    if (currentMode === '1v3') {
        await findSquadMatch();
    } else if (currentMode === '1v2') {
        await findTriosMatch();
    } else {
        await find1v1Match();
    }
}

// Find 1v1 match
async function find1v1Match() {
    try {
        // Clean up old waiting entries
        const waitingRef = database.ref('waiting_1v1');
        console.log('📡 Checking 1v1 queue...');
        const snapshot = await waitingRef.once('value');
        const waiting = snapshot.val() || {};
        console.log('✅ Connected to database. Waiting 1v1 players:', Object.keys(waiting).length);

        // Remove stale entries (older than 30 seconds)
        const now = Date.now();
        Object.keys(waiting).forEach(key => {
            if (waiting[key] && now - waiting[key].timestamp > 30000) {
                console.log('🗑️ Removing stale player:', key);
                waitingRef.child(key).remove();
            }
        });

        // Check for available opponent
        const freshSnapshot = await waitingRef.once('value');
        const freshWaiting = freshSnapshot.val() || {};
        const availablePlayers = Object.entries(freshWaiting).filter(([id]) => id !== playerData.id);

        console.log('Available opponents:', availablePlayers.length);

        if (availablePlayers.length > 0) {
            // Match found!
            const [opponentId, opponentData] = availablePlayers[0];
            console.log('✅ Match found! Opponent:', opponentData.username);

            // Remove opponent from waiting
            await waitingRef.child(opponentId).remove();

            // Also remove self if in queue
            await waitingRef.child(playerData.id).remove();

            // Create game
            const gameId = generateId();
            const questions = generateQuiz();

            const gameData = {
                id: gameId,
                player1: {
                    id: playerData.id,
                    username: playerData.username,
                    color: playerData.color,
                    level: playerData.level || 1,
                    score: 0,
                    answers: [],
                    finished: false
                },
                player2: {
                    id: opponentId,
                    username: opponentData.username,
                    color: opponentData.color,
                    level: opponentData.level || 1,
                    score: 0,
                    answers: [],
                    finished: false
                },
                questions: questions,
                createdAt: Date.now(),
                gameStartedAt: firebase.database.ServerValue.TIMESTAMP,
                timeExpired: false
            };

            console.log('🎮 Creating game:', gameId);
            await database.ref(`games/${gameId}`).set(gameData);

            // v1.5: Show match found notification
            showNotification('Match Found!', `Starting ${currentMode.toUpperCase()} game...`, '🎮');

            // Start game for both players
            setTimeout(() => startGame(gameId, gameData), 1000); // Delay for notification
        } else {
            // Add self to waiting
            console.log('⏳ No opponents found. Joining waiting queue...');
            await waitingRef.child(playerData.id).set({
                username: playerData.username,
                color: playerData.color,
                level: playerData.level || 1,
                timestamp: Date.now()
            });
            console.log('✅ Added to queue. Waiting for opponent...');

            // Clean up old listener if exists
            if (searchListener) {
                database.ref('games').off('child_added', searchListener);
            }

            // Listen for game creation
            searchListener = database.ref('games').on('child_added', (snapshot) => {
                const game = snapshot.val();
                console.log('🎮 New game detected:', game.id);

                if (game && game.player2 && game.player2.id === playerData.id) {
                    // Found a game!
                    console.log('✅ Matched! Starting game...');
                    showNotification('Match Found!', `Opponent found! Starting 1v1...`, '⚔️'); // v1.5

                    if (searchListener) {
                        database.ref('games').off('child_added', searchListener);
                        searchListener = null;
                    }

                    // Remove from waiting
                    database.ref(`waiting_1v1/${playerData.id}`).remove();

                    setTimeout(() => startGame(game.id, game), 1000); // v1.5: Delay for notification
                }
            });
        }
    } catch (error) {
        console.error('❌ 1v1 Matchmaking error:', error);
        handleMatchmakingError(error);
    }
}

// Find Trios match (3 players)
async function findTriosMatch() {
    try {
        const waitingRef = database.ref('waiting_trios');
        console.log('📡 Checking trios queue...');
        const snapshot = await waitingRef.once('value');
        const waiting = snapshot.val() || {};
        console.log('✅ Connected to database. Waiting trios players:', Object.keys(waiting).length);

        // Clean up stale entries
        const now = Date.now();
        Object.keys(waiting).forEach(key => {
            if (waiting[key] && now - waiting[key].timestamp > 60000) { // 60 sec for trios
                console.log('🗑️ Removing stale trios player:', key);
                waitingRef.child(key).remove();
            }
        });

        // Check if we have 3 players
        const freshSnapshot = await waitingRef.once('value');
        const freshWaiting = freshSnapshot.val() || {};
        const availablePlayers = Object.entries(freshWaiting).filter(([id]) => id !== playerData.id);

        console.log('Trios queue:', availablePlayers.length + 1, '/ 3 players');

        if (availablePlayers.length >= 2) {
            // We have 3 players! (2 + myself)
            console.log('✅ Trios ready! 3 players found!');

            const triosPlayers = [
                { id: playerData.id, ...playerData },
                ...availablePlayers.slice(0, 2).map(([id, data]) => ({ id, ...data }))
            ];

            // Remove all players from waiting
            for (const player of triosPlayers) {
                await waitingRef.child(player.id).remove();
            }

            // Create trios game
            const gameId = generateId();
            const questions = generateQuiz();

            const gameData = {
                id: gameId,
                mode: 'trios',
                players: triosPlayers.map(p => ({
                    id: p.id,
                    username: p.username,
                    color: p.color,
                    score: 0,
                    answers: [],
                    finished: false
                })),
                questions: questions,
                createdAt: Date.now(),
                gameStartedAt: firebase.database.ServerValue.TIMESTAMP,
                timeExpired: false
            };

            console.log('🎮 Creating trios game:', gameId);
            await database.ref(`games_trios/${gameId}`).set(gameData);

            startTriosGame(gameId, gameData);
        } else {
            // Add self to waiting
            console.log(`⏳ Waiting for trios... (${availablePlayers.length + 1}/3 players)`);
            await waitingRef.child(playerData.id).set({
                username: playerData.username,
                color: playerData.color,
                timestamp: Date.now()
            });

            // Update searching text
            document.querySelector('.searching-text').textContent =
                `Waiting for trios... (${availablePlayers.length + 1}/3 players)`;

            // Clean up old listener
            if (searchListener) {
                database.ref('games_trios').off('child_added', searchListener);
            }

            // Listen for trios game creation
            searchListener = database.ref('games_trios').on('child_added', (snapshot) => {
                const game = snapshot.val();
                console.log('🎮 New trios game detected:', game.id);

                // Check if I'm in this game
                const imInGame = game.players && game.players.some(p => p.id === playerData.id);

                if (imInGame) {
                    console.log('✅ Joined trios game!');
                    showNotification('Match Found!', `Trios match ready! Starting 1v2...`, '🔺'); // v1.5

                    if (searchListener) {
                        database.ref('games_trios').off('child_added', searchListener);
                        searchListener = null;
                    }

                    database.ref(`waiting_trios/${playerData.id}`).remove();
                    setTimeout(() => startTriosGame(game.id, game), 1000); // v1.5: Delay for notification
                }
            });
        }
    } catch (error) {
        console.error('❌ Trios matchmaking error:', error);
        handleMatchmakingError(error);
    }
}

// Find Squad match (4 players)
async function findSquadMatch() {
    try {
        const waitingRef = database.ref('waiting_squad');
        console.log('📡 Checking squad queue...');
        const snapshot = await waitingRef.once('value');
        const waiting = snapshot.val() || {};
        console.log('✅ Connected to database. Waiting squad players:', Object.keys(waiting).length);

        // Clean up stale entries
        const now = Date.now();
        Object.keys(waiting).forEach(key => {
            if (waiting[key] && now - waiting[key].timestamp > 60000) { // 60 sec for squad
                console.log('🗑️ Removing stale squad player:', key);
                waitingRef.child(key).remove();
            }
        });

        // Check if we have 4 players
        const freshSnapshot = await waitingRef.once('value');
        const freshWaiting = freshSnapshot.val() || {};
        const availablePlayers = Object.entries(freshWaiting).filter(([id]) => id !== playerData.id);

        console.log('Squad queue:', availablePlayers.length + 1, '/ 4 players');

        if (availablePlayers.length >= 3) {
            // We have 4 players! (3 + myself)
            console.log('✅ Squad ready! 4 players found!');

            const squadPlayers = [
                { id: playerData.id, ...playerData },
                ...availablePlayers.slice(0, 3).map(([id, data]) => ({ id, ...data }))
            ];

            // Remove all players from waiting
            for (const player of squadPlayers) {
                await waitingRef.child(player.id).remove();
            }

            // Create squad game
            const gameId = generateId();
            const questions = generateQuiz();

            const gameData = {
                id: gameId,
                mode: 'squad',
                players: squadPlayers.map(p => ({
                    id: p.id,
                    username: p.username,
                    color: p.color,
                    score: 0,
                    answers: [],
                    finished: false
                })),
                questions: questions,
                createdAt: Date.now(),
                gameStartedAt: firebase.database.ServerValue.TIMESTAMP,
                timeExpired: false
            };

            console.log('🎮 Creating squad game:', gameId);
            await database.ref(`games_squad/${gameId}`).set(gameData);

            startSquadGame(gameId, gameData);
        } else {
            // Add self to waiting
            console.log(`⏳ Waiting for squad... (${availablePlayers.length + 1}/4 players)`);
            await waitingRef.child(playerData.id).set({
                username: playerData.username,
                color: playerData.color,
                timestamp: Date.now()
            });

            // Update searching text
            document.querySelector('.searching-text').textContent =
                `Waiting for squad... (${availablePlayers.length + 1}/4 players)`;

            // Clean up old listener
            if (searchListener) {
                database.ref('games_squad').off('child_added', searchListener);
            }

            // Listen for squad game creation
            searchListener = database.ref('games_squad').on('child_added', (snapshot) => {
                const game = snapshot.val();
                console.log('🎮 New squad game detected:', game.id);

                // Check if I'm in this game
                const imInGame = game.players && game.players.some(p => p.id === playerData.id);

                if (imInGame) {
                    console.log('✅ Joined squad game!');
                    showNotification('Match Found!', `Squad ready! Starting 1v3...`, '👥'); // v1.5

                    if (searchListener) {
                        database.ref('games_squad').off('child_added', searchListener);
                        searchListener = null;
                    }

                    database.ref(`waiting_squad/${playerData.id}`).remove();
                    setTimeout(() => startSquadGame(game.id, game), 1000); // v1.5: Delay for notification
                }
            });
        }
    } catch (error) {
        console.error('❌ Squad matchmaking error:', error);
        handleMatchmakingError(error);
    }
}

// Handle matchmaking errors
function handleMatchmakingError(error) {
    let errorMessage = '❌ Matchmaking failed!\n\n';

    if (error.code === 'PERMISSION_DENIED') {
        errorMessage += 'Database permission denied.\n\n';
        errorMessage += 'Please check:\n';
        errorMessage += '1. Go to Firebase Console\n';
        errorMessage += '2. Realtime Database → Rules\n';
        errorMessage += '3. Set rules to allow read/write:\n';
        errorMessage += '{\n  "rules": {\n    ".read": true,\n    ".write": true\n  }\n}';
    } else if (error.message && error.message.includes('Failed to get document')) {
        errorMessage += 'Cannot connect to Firebase.\n\n';
        errorMessage += 'Check your Firebase config in client.js';
    } else {
        errorMessage += 'Error: ' + error.message + '\n\n';
        errorMessage += 'Please check browser console (F12) for details.';
    }

    alert(errorMessage);
    showScreen('menuScreen');
}

// Start game (1v1)
function startGame(gameId, gameData) {
    antiCheatActive = true; // v1.5: Enable anti-tab-switch detection
    currentGame.gameId = gameId;
    currentGame.questions = gameData.questions;
    currentGame.answers = [];
    currentGame.currentQuestionIndex = 0;
    currentGame.mode = '1v1';
    currentGame.gameStartedAt = gameData.gameStartedAt || Date.now();

    // Determine which player we are
    const isPlayer1 = gameData.player1.id === playerData.id;
    const opponent = isPlayer1 ? gameData.player2 : gameData.player1;

    currentGame.opponent = opponent.id;
    currentGame.opponentColor = opponent.color;
    currentGame.opponentUsername = opponent.username;

    showScreen('gameScreen');

    // Setup player displays with levels
    document.getElementById('yourName').innerHTML = playerData.username + getLevelDisplay(playerData.level);
    document.getElementById('opponentName').innerHTML = opponent.username + getLevelDisplay(opponent.level || 1);

    const yourAvatar = document.getElementById('yourAvatar');
    const opponentAvatar = document.getElementById('opponentAvatar');

    applyAvatarStyle(yourAvatar, playerData.color);
    applyAvatarStyle(opponentAvatar, opponent.color);

    // Show first question
    showQuestion();

    // Start the game timer
    startGameTimer();

    // Listen for game updates (including timeExpired flag)
    gameListener = database.ref(`games/${gameId}`).on('value', (snapshot) => {
        const game = snapshot.val();
        if (game) {
            // Check if time expired and force finish all players
            if (game.timeExpired && !game.player1.finished && game.player1.id === playerData.id) {
                console.log('⏰ Time expired detected! Auto-submitting...');
                handleTimeUp();
            } else if (game.timeExpired && !game.player2.finished && game.player2.id === playerData.id) {
                console.log('⏰ Time expired detected! Auto-submitting...');
                handleTimeUp();
            }
            checkGameEnd(game);
        }
    });
}

// Start 1v2 Game (3 players)
function startTriosGame(gameId, gameData) {
    currentGame.gameId = gameId;
    currentGame.questions = gameData.questions;
    currentGame.answers = [];
    currentGame.currentQuestionIndex = 0;
    currentGame.mode = '1v2';
    currentGame.players = gameData.players;
    currentGame.gameStartedAt = gameData.gameStartedAt || Date.now();

    showScreen('gameScreen');

    // Show 1v2 display
    const myPlayerIndex = gameData.players.findIndex(p => p.id === playerData.id);
    const otherPlayer = gameData.players.find(p => p.id !== playerData.id);

    document.getElementById('yourName').textContent = `${playerData.username} (1v2)`;
    document.getElementById('opponentName').textContent = `2 Opponents`;

    const yourAvatar = document.getElementById('yourAvatar');
    const opponentAvatar = document.getElementById('opponentAvatar');

    applyAvatarStyle(yourAvatar, playerData.color);
    if (otherPlayer) {
        applyAvatarStyle(opponentAvatar, otherPlayer.color);
    }

    // Show first question
    showQuestion();

    // Start the game timer
    startGameTimer();

    // Listen for 1v2 game updates (including timeExpired flag)
    gameListener = database.ref(`games_trios/${gameId}`).on('value', (snapshot) => {
        const game = snapshot.val();
        if (game) {
            // Check if time expired and force finish
            const myPlayer = game.players.find(p => p.id === playerData.id);
            if (game.timeExpired && myPlayer && !myPlayer.finished) {
                console.log('⏰ Time expired detected! Auto-submitting...');
                handleTimeUp();
            }
            checkTriosGameEnd(game);
        }
    });
}

// Start 1v3 Game (4 players)
function startSquadGame(gameId, gameData) {
    currentGame.gameId = gameId;
    currentGame.questions = gameData.questions;
    currentGame.answers = [];
    currentGame.currentQuestionIndex = 0;
    currentGame.mode = '1v3';
    currentGame.players = gameData.players;
    currentGame.gameStartedAt = gameData.gameStartedAt || Date.now();

    showScreen('gameScreen');

    // Show 1v3 display
    const myPlayerIndex = gameData.players.findIndex(p => p.id === playerData.id);
    const otherPlayer = gameData.players.find(p => p.id !== playerData.id);

    document.getElementById('yourName').textContent = `${playerData.username} (1v3)`;
    document.getElementById('opponentName').textContent = `3 Opponents`;

    const yourAvatar = document.getElementById('yourAvatar');
    const opponentAvatar = document.getElementById('opponentAvatar');

    applyAvatarStyle(yourAvatar, playerData.color);
    if (otherPlayer) {
        applyAvatarStyle(opponentAvatar, otherPlayer.color);
    }

    // Show first question
    showQuestion();

    // Start the game timer
    startGameTimer();

    // Listen for 1v3 game updates (including timeExpired flag)
    gameListener = database.ref(`games_squad/${gameId}`).on('value', (snapshot) => {
        const game = snapshot.val();
        if (game) {
            // Check if time expired and force finish
            const myPlayer = game.players.find(p => p.id === playerData.id);
            if (game.timeExpired && myPlayer && !myPlayer.finished) {
                console.log('⏰ Time expired detected! Auto-submitting...');
                handleTimeUp();
            }
            checkSquadGameEnd(game);
        }
    });
}

// Show question
function showQuestion() {
    const index = currentGame.currentQuestionIndex;
    const question = currentGame.questions[index];

    document.getElementById('questionText').textContent = question.question;
    document.getElementById('answerInput').value = '';
    document.getElementById('currentQuestion').textContent = index + 1;

    // Update progress bar
    const progress = ((index + 1) / 8) * 100;
    document.getElementById('progressBar').style.width = progress + '%';

    // Focus on input
    document.getElementById('answerInput').focus();
}

// Start game timer
function startGameTimer() {
    timeRemaining = 80; // Reset to 1:20
    updateTimerDisplay();

    if (gameTimer) {
        clearInterval(gameTimer);
    }

    gameTimer = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        updateWaitingTimerDisplay(); // Also update waiting screen timer

        if (timeRemaining <= 0) {
            clearInterval(gameTimer);
            handleTimeUp();

            // When timer expires, check if we should show results button
            checkIfResultsReady();
        }
    }, 1000);
}

// Check if results are ready to view
function checkIfResultsReady() {
    if (resultsReadyToView) {
        // Show the View Results button
        const viewBtn = document.getElementById('viewResultsBtn');
        if (viewBtn) {
            document.getElementById('waitingResultsText').textContent = 'All players finished and time is up!';
            viewBtn.style.display = 'block';
        }
    }
}

// v1.5: Vote to Skip Timer System
let voteSkipListener = null;
let hasVoted = false;

function setupVoteToSkipTimer() {
    console.log('⏭️ Setting up vote to skip timer system');
    hasVoted = false;

    // Show the vote container
    const voteContainer = document.getElementById('voteSkipContainer');
    if (voteContainer) {
        voteContainer.style.display = 'block';
    }

    // Determine total player count
    const totalPlayers = currentGame.mode === '1v3' ? 4 : currentGame.mode === '1v2' ? 3 : 2;

    // Update vote count display
    document.getElementById('voteCount').textContent = `0/${totalPlayers} voted`;

    // Get the appropriate game reference
    const gameRef = currentGame.mode === 'squad'
        ? database.ref(`games_squad/${currentGame.gameId}`)
        : currentGame.mode === 'trios'
        ? database.ref(`games_trios/${currentGame.gameId}`)
        : database.ref(`games/${currentGame.gameId}`);

    // Listen for vote changes
    voteSkipListener = gameRef.child('skipVotes').on('value', (snapshot) => {
        const votes = snapshot.val() || {};
        const voteCount = Object.keys(votes).length;

        console.log(`📊 Skip votes: ${voteCount}/${totalPlayers}`);

        // Update UI
        document.getElementById('voteCount').textContent = `${voteCount}/${totalPlayers} voted`;

        // Check if this player voted
        if (votes[playerData.id]) {
            const voteBtn = document.getElementById('voteSkipBtn');
            if (voteBtn) {
                voteBtn.textContent = '✓ You Voted to Skip';
                voteBtn.classList.add('voted');
                voteBtn.disabled = true;
            }
        }

        // If all players voted, skip timer immediately
        if (voteCount >= totalPlayers) {
            console.log('🎉 All players voted! Skipping timer...');
            skipTimerFromVote();
        }
    });
}

async function voteToSkipTimer() {
    if (hasVoted) return;

    console.log('⏭️ Player voted to skip timer');
    hasVoted = true;

    // Get the appropriate game reference
    const gameRef = currentGame.mode === 'squad'
        ? database.ref(`games_squad/${currentGame.gameId}`)
        : currentGame.mode === 'trios'
        ? database.ref(`games_trios/${currentGame.gameId}`)
        : database.ref(`games/${currentGame.gameId}`);

    // Record vote
    await gameRef.child(`skipVotes/${playerData.id}`).set(true);

    showNotification('Vote Recorded', 'Waiting for other players...', '⏭️');
}

function skipTimerFromVote() {
    console.log('⏩ Skipping timer due to unanimous vote');

    // Clean up vote listener
    if (voteSkipListener) {
        const gameRef = currentGame.mode === 'squad'
            ? database.ref(`games_squad/${currentGame.gameId}`)
            : currentGame.mode === 'trios'
            ? database.ref(`games_trios/${currentGame.gameId}`)
            : database.ref(`games/${currentGame.gameId}`);

        gameRef.child('skipVotes').off('value', voteSkipListener);
        voteSkipListener = null;
    }

    // Hide vote container
    const voteContainer = document.getElementById('voteSkipContainer');
    if (voteContainer) {
        voteContainer.style.display = 'none';
    }

    // Show notification
    showNotification('Timer Skipped!', 'All players voted. Showing results...', '🎉');

    // Mark results as ready and show them
    resultsReadyToView = true;
    setTimeout(() => {
        checkIfResultsReady();
        // Auto-click view results button
        const viewBtn = document.getElementById('viewResultsBtn');
        if (viewBtn && viewBtn.style.display !== 'none') {
            viewBtn.click();
        }
    }, 1500);
}

// Update timer display
function updateTimerDisplay() {
    const timerElement = document.getElementById('gameTimer');
    if (!timerElement) return;

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const secondsStr = seconds < 10 ? '0' + seconds : seconds;
    timerElement.textContent = minutes + ':' + secondsStr;

    // Change color based on time remaining
    timerElement.classList.remove('warning', 'critical');
    if (timeRemaining <= 10) {
        timerElement.classList.add('critical');
    } else if (timeRemaining <= 30) {
        timerElement.classList.add('warning');
    }
}

// Handle when time runs out
async function handleTimeUp() {
    console.log('⏰ Time is up! Auto-submitting...');

    // Set timeExpired flag in database (only if not already set)
    try {
        const gameRef = currentGame.mode === 'squad'
            ? database.ref(`games_squad/${currentGame.gameId}`)
            : currentGame.mode === 'trios'
            ? database.ref(`games_trios/${currentGame.gameId}`)
            : database.ref(`games/${currentGame.gameId}`);

        // Use transaction to ensure only one client sets this
        await gameRef.child('timeExpired').transaction((current) => {
            if (current === null || current === false) {
                return true;
            }
            return current; // Already set, don't change
        });
    } catch (error) {
        console.warn('⚠️ Could not set timeExpired flag:', error);
    }

    // Fill remaining answers with empty strings (will be marked as incorrect)
    while (currentGame.answers.length < currentGame.questions.length) {
        currentGame.answers.push('');
    }

    // Submit answers
    submitAnswers();
}

// Stop game timer
function stopGameTimer() {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
}

// Update waiting timer display
function updateWaitingTimerDisplay() {
    const timerElement = document.getElementById('waitingTimer');
    if (!timerElement) return;

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const secondsStr = seconds < 10 ? '0' + seconds : seconds;
    timerElement.textContent = minutes + ':' + secondsStr;

    // Change color based on time remaining
    timerElement.classList.remove('warning', 'critical');
    if (timeRemaining <= 10) {
        timerElement.classList.add('critical');
    } else if (timeRemaining <= 30) {
        timerElement.classList.add('warning');
    }
}

// Next question
function nextQuestion() {
    const answer = document.getElementById('answerInput').value;
    currentGame.answers.push(answer);

    currentGame.currentQuestionIndex++;

    if (currentGame.currentQuestionIndex < currentGame.questions.length) {
        showQuestion();
    } else {
        // Submit answers
        submitAnswers();
    }
}

// Submit answers
async function submitAnswers() {
    // Disable anti-cheat when submitting (game is over for this player)
    antiCheatActive = false;

    // Don't stop the timer - keep it running!
    // stopGameTimer();

    // Calculate score
    let score = 0;
    currentGame.answers.forEach((answer, index) => {
        if (parseInt(answer) === currentGame.questions[index].answer) {
            score++;
        }
    });

    myGameScore = score; // Store for later

    if (currentGame.mode === '1v3') {
        // 1v3 mode: update player in players array
        const myIndex = currentGame.players.findIndex(p => p.id === playerData.id);

        await database.ref(`games_squad/${currentGame.gameId}/players/${myIndex}`).update({
            score: score,
            answers: currentGame.answers,
            finished: true
        });
    } else if (currentGame.mode === '1v2') {
        // 1v2 mode: update player in players array
        const myIndex = currentGame.players.findIndex(p => p.id === playerData.id);

        await database.ref(`games_trios/${currentGame.gameId}/players/${myIndex}`).update({
            score: score,
            answers: currentGame.answers,
            finished: true
        });
    } else {
        // 1v1 mode
        const isPlayer1 = await checkIfPlayer1();
        const playerKey = isPlayer1 ? 'player1' : 'player2';

        await database.ref(`games/${currentGame.gameId}/${playerKey}`).update({
            score: score,
            answers: currentGame.answers,
            finished: true
        });
    }

    // Show waiting for results screen with timer still running
    showScreen('waitingResultsScreen');
    document.getElementById('waitingResultsTitle').textContent = 'Quiz Complete!';
    const waitText = currentGame.mode === '1v3' ? 'Waiting for all 4 players to finish...' :
                     currentGame.mode === '1v2' ? 'Waiting for all 3 players to finish...' :
                     'Waiting for opponent to finish...';
    document.getElementById('waitingResultsText').textContent = waitText;

    // v1.5: ALWAYS show vote to skip timer - no matter when you finish
    setupVoteToSkipTimer();

    // Continue updating the timer display on the waiting screen
    updateWaitingTimerDisplay();
}

// Check if player1
async function checkIfPlayer1() {
    const snapshot = await database.ref(`games/${currentGame.gameId}/player1/id`).once('value');
    return snapshot.val() === playerData.id;
}

// Check if game ended
async function checkGameEnd(game) {
    const allFinished = game.player1.finished && game.player2.finished;

    console.log('🎮 Game state:', {
        player1Finished: game.player1.finished,
        player2Finished: game.player2.finished,
        allFinished: allFinished,
        timeExpired: game.timeExpired,
        resultsReadyAt: game.resultsReadyAt
    });

    if (allFinished) {
        // Use transaction to ensure only one client sets resultsReadyAt
        if (!game.resultsReadyAt) {
            try {
                const ref = database.ref(`games/${currentGame.gameId}/resultsReadyAt`);
                await ref.transaction((current) => {
                    if (current === null) {
                        return Date.now();
                    }
                    return current; // Already set
                });
                console.log('✅ Results timestamp set');
                return; // Wait for it to propagate and trigger this function again
            } catch (error) {
                console.warn('⚠️ Could not set results timestamp:', error);
                // Continue anyway
            }
        }

        // Results are ready! Store the data but don't show yet
        console.log('📊 Results ready, waiting for manual view...');

        if (gameListener) {
            database.ref(`games/${currentGame.gameId}`).off('value', gameListener);
            gameListener = null;
        }

        const isPlayer1 = game.player1.id === playerData.id;
        myGameScore = isPlayer1 ? game.player1.score : game.player2.score;
        opponentGameScore = isPlayer1 ? game.player2.score : game.player1.score;

        gameWon = myGameScore > opponentGameScore;
        gameDraw = myGameScore === opponentGameScore;

        resultsReadyToView = true;

        // Check if timer has expired and show button if so
        if (timeRemaining <= 0 || game.timeExpired) {
            checkIfResultsReady();
        }

        // Clean up game after 60 seconds
        setTimeout(() => {
            database.ref(`games/${currentGame.gameId}`).remove();
        }, 60000);
    }
}

// Check if trios game ended
async function checkTriosGameEnd(game) {
    // Check if all 3 players finished
    const allFinished = game.players.every(p => p.finished);

    if (allFinished) {
        // All players finished! Try to sync results display
        if (!game.resultsReadyAt) {
            try {
                await database.ref(`games_trios/${currentGame.gameId}/resultsReadyAt`).set(Date.now());
                return; // Wait for the timestamp to propagate
            } catch (error) {
                console.warn('⚠️ Could not set results timestamp, showing results immediately:', error);
                // Continue to show results anyway (fallback to immediate display)
            }
        }

        // Results are ready! Show them now
        if (gameListener) {
            database.ref(`games_trios/${currentGame.gameId}`).off('value', gameListener);
            gameListener = null;
        }

        // Sort players by score
        const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
        const myPlayer = game.players.find(p => p.id === playerData.id);
        const myRank = sortedPlayers.findIndex(p => p.id === playerData.id) + 1;

        // Winner gets 100 points + XP
        if (myRank === 1) {
            playerData.points += 100;
            playerData.wins = (playerData.wins || 0) + 1; // Track wins for cosmetic unlocks
            awardXP(50); // Winner gets 50 XP
        } else {
            awardXP(20); // Participants get 20 XP
        }

        showTriosResults(game.players, myPlayer, myRank);

        // Clean up game after 30 seconds
        setTimeout(() => {
            database.ref(`games_trios/${currentGame.gameId}`).remove();
        }, 30000);
    }
}

// Check if squad game ended
async function checkSquadGameEnd(game) {
    // Check if all 4 players finished
    const allFinished = game.players.every(p => p.finished);

    if (allFinished) {
        // All players finished! Try to sync results display
        if (!game.resultsReadyAt) {
            try {
                await database.ref(`games_squad/${currentGame.gameId}/resultsReadyAt`).set(Date.now());
                return; // Wait for the timestamp to propagate
            } catch (error) {
                console.warn('⚠️ Could not set results timestamp, showing results immediately:', error);
                // Continue to show results anyway (fallback to immediate display)
            }
        }

        // Results are ready! Show them now
        if (gameListener) {
            database.ref(`games_squad/${currentGame.gameId}`).off('value', gameListener);
            gameListener = null;
        }

        // Sort players by score
        const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
        const myPlayer = game.players.find(p => p.id === playerData.id);
        const myRank = sortedPlayers.findIndex(p => p.id === playerData.id) + 1;

        // Winner gets 100 points + XP
        if (myRank === 1) {
            playerData.points += 100;
            playerData.wins = (playerData.wins || 0) + 1; // Track wins for cosmetic unlocks
            awardXP(60); // Squad winner gets 60 XP (4 players is harder)
        } else {
            awardXP(25); // Participants get 25 XP
        }

        showSquadResults(game.players, myPlayer, myRank);

        // Clean up game after 30 seconds
        setTimeout(() => {
            database.ref(`games_squad/${currentGame.gameId}`).remove();
        }, 30000);
    }
}

// Show trios results
function showTriosResults(players, myPlayer, myRank) {
    showScreen('resultsScreen');

    // Reset searching screen text
    document.querySelector('.searching-animation h2').textContent = 'Finding Opponent...';
    document.querySelector('.searching-text').textContent = 'Matching you with another player';

    const resultBanner = document.getElementById('resultBanner');

    if (myRank === 1) {
        resultBanner.textContent = '🏆 YOU WIN!';
        resultBanner.className = 'result-banner win';
    } else if (myRank === 2) {
        resultBanner.textContent = '🥈 2ND PLACE!';
        resultBanner.className = 'result-banner draw';
    } else {
        resultBanner.textContent = '🥉 3RD PLACE';
        resultBanner.className = 'result-banner lose';
    }

    // Show trios scoreboard
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    document.getElementById('yourScore').textContent = myPlayer.score;
    document.getElementById('opponentScore').textContent = `Rank #${myRank}`;

    // Show points earned
    const pointsEarned = document.getElementById('pointsEarned');
    if (myRank === 1) {
        pointsEarned.textContent = '+100 points earned!';
        pointsEarned.style.display = 'block';
    } else {
        pointsEarned.style.display = 'none';
    }

    // Update player points display
    updatePlayerDisplay();

    // Show answer review with trios leaderboard
    const answersReview = document.getElementById('answersReview');
    answersReview.innerHTML = '<h3 style="margin-bottom: 15px;">Trios Leaderboard</h3>';

    sortedPlayers.forEach((player, index) => {
        const rank = index + 1;
        const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
        const isMe = player.id === playerData.id;

        const playerItem = document.createElement('div');
        playerItem.className = `answer-item ${isMe ? 'correct' : ''}`;
        playerItem.innerHTML = `
            <span>${rankEmoji} <strong>${player.username}</strong> ${isMe ? '(You)' : ''}</span>
            <span>${player.score}/8 correct</span>
        `;
        answersReview.appendChild(playerItem);
    });
}

// Show squad results
function showSquadResults(players, myPlayer, myRank) {
    showScreen('resultsScreen');

    // Reset searching screen text
    document.querySelector('.searching-animation h2').textContent = 'Finding Opponent...';
    document.querySelector('.searching-text').textContent = 'Matching you with another player';

    const resultBanner = document.getElementById('resultBanner');

    if (myRank === 1) {
        resultBanner.textContent = '🏆 YOU WIN!';
        resultBanner.className = 'result-banner win';
    } else if (myRank === 2) {
        resultBanner.textContent = '🥈 2ND PLACE!';
        resultBanner.className = 'result-banner draw';
    } else if (myRank === 3) {
        resultBanner.textContent = '🥉 3RD PLACE';
        resultBanner.className = 'result-banner lose';
    } else {
        resultBanner.textContent = '4TH PLACE';
        resultBanner.className = 'result-banner lose';
    }

    // Show squad scoreboard
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    document.getElementById('yourScore').textContent = myPlayer.score;
    document.getElementById('opponentScore').textContent = `Rank #${myRank}`;

    // Show points earned
    const pointsEarned = document.getElementById('pointsEarned');
    if (myRank === 1) {
        pointsEarned.textContent = '+100 points earned!';
        pointsEarned.style.display = 'block';
    } else {
        pointsEarned.style.display = 'none';
    }

    // Update player points display
    updatePlayerDisplay();

    // Show answer review with squad leaderboard
    const answersReview = document.getElementById('answersReview');
    answersReview.innerHTML = '<h3 style="margin-bottom: 15px;">Squad Leaderboard</h3>';

    sortedPlayers.forEach((player, index) => {
        const rank = index + 1;
        const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '4️⃣';
        const isMe = player.id === playerData.id;

        const playerItem = document.createElement('div');
        playerItem.className = `answer-item ${isMe ? 'correct' : ''}`;
        playerItem.innerHTML = `
            <span>${rankEmoji} <strong>${player.username}</strong> ${isMe ? '(You)' : ''}</span>
            <span>${player.score}/8 correct</span>
        `;
        answersReview.appendChild(playerItem);
    });
}

// Show results (1v1)
function showResults(myScore, opponentScore, won, draw) {
    showScreen('resultsScreen');

    // Reset searching screen text
    document.querySelector('.searching-animation h2').textContent = 'Finding Opponent...';
    document.querySelector('.searching-text').textContent = 'Matching you with another player';

    const resultBanner = document.getElementById('resultBanner');

    if (won) {
        resultBanner.textContent = 'YOU WIN!';
        resultBanner.className = 'result-banner win';
    } else if (draw) {
        resultBanner.textContent = "IT'S A DRAW!";
        resultBanner.className = 'result-banner draw';
    } else {
        resultBanner.textContent = 'YOU LOSE';
        resultBanner.className = 'result-banner lose';
    }

    document.getElementById('yourScore').textContent = myScore;
    document.getElementById('opponentScore').textContent = opponentScore;

    // Show points earned
    const pointsEarned = document.getElementById('pointsEarned');
    if (won) {
        pointsEarned.textContent = '+100 points earned!';
        pointsEarned.style.display = 'block';
    } else {
        pointsEarned.style.display = 'none';
    }

    // Update player points display
    updatePlayerDisplay();

    // Show answer review
    const answersReview = document.getElementById('answersReview');
    answersReview.innerHTML = '<h3 style="margin-bottom: 15px;">Answer Review</h3>';

    currentGame.questions.forEach((question, index) => {
        const userAnswer = currentGame.answers[index];
        const correctAnswer = question.answer;
        const isCorrect = parseInt(userAnswer) === correctAnswer;

        const answerItem = document.createElement('div');
        answerItem.className = `answer-item ${isCorrect ? 'correct' : 'incorrect'}`;
        answerItem.innerHTML = `
            <span><strong>Q${index + 1}:</strong> ${question.question}</span>
            <span>Your answer: ${userAnswer || 'N/A'} ${isCorrect ? '✓' : '✗ (' + correctAnswer + ')'}</span>
        `;
        answersReview.appendChild(answerItem);
    });
}

// Cosmetics Database - EXPANDED
const COSMETICS = {
    // Ultra cheap colors (50-75 pts)
    'brown': { id: 'brown', name: 'Brown', desc: 'Earthy brown', cost: 50, type: 'color', value: '#795548', winsRequired: 0 },
    'gray': { id: 'gray', name: 'Gray', desc: 'Neutral gray', cost: 50, type: 'color', value: '#9E9E9E', winsRequired: 0 },
    'lime': { id: 'lime', name: 'Lime Green', desc: 'Bright lime', cost: 75, type: 'color', value: '#CDDC39', winsRequired: 0 },
    'cyan': { id: 'cyan', name: 'Cyan', desc: 'Electric cyan', cost: 75, type: 'color', value: '#00BCD4', winsRequired: 0 },

    // Basic colors (100-150 pts)
    'red': { id: 'red', name: 'Red', desc: 'Bold and vibrant red', cost: 100, type: 'color', value: '#FF5252', winsRequired: 0 },
    'blue': { id: 'blue', name: 'Blue', desc: 'Cool ocean blue', cost: 100, type: 'color', value: '#2196F3', winsRequired: 0 },
    'green': { id: 'green', name: 'Green', desc: 'Fresh emerald green', cost: 100, type: 'color', value: '#4CAF50', winsRequired: 0 },
    'purple': { id: 'purple', name: 'Purple', desc: 'Royal purple', cost: 150, type: 'color', value: '#9C27B0', winsRequired: 0 },
    'pink': { id: 'pink', name: 'Pink', desc: 'Sweet bubblegum pink', cost: 150, type: 'color', value: '#E91E63', winsRequired: 0 },
    'orange': { id: 'orange', name: 'Orange', desc: 'Warm sunset orange', cost: 150, type: 'color', value: '#FF9800', winsRequired: 0 },

    // Premium colors (500-1000 pts)
    'teal': { id: 'teal', name: 'Teal', desc: 'Deep teal', cost: 500, type: 'color', value: '#009688', winsRequired: 0 },
    'indigo': { id: 'indigo', name: 'Indigo', desc: 'Deep indigo', cost: 500, type: 'color', value: '#3F51B5', winsRequired: 0 },
    'crimson': { id: 'crimson', name: 'Crimson', desc: 'Dark crimson red', cost: 750, type: 'color', value: '#DC143C', winsRequired: 0 },
    'emerald': { id: 'emerald', name: 'Emerald', desc: 'Rich emerald green', cost: 750, type: 'color', value: '#50C878', winsRequired: 0 },
    'sapphire': { id: 'sapphire', name: 'Sapphire', desc: 'Deep sapphire blue', cost: 1000, type: 'color', value: '#0F52BA', winsRequired: 0 },
    'ruby': { id: 'ruby', name: 'Ruby', desc: 'Precious ruby red', cost: 1000, type: 'color', value: '#E0115F', winsRequired: 0 },

    // Expensive colors (2000-5000 pts)
    'neon_pink': { id: 'neon_pink', name: 'Neon Pink', desc: 'Glowing neon pink', cost: 2000, type: 'color', value: '#FF10F0', winsRequired: 0, special: true },
    'neon_green': { id: 'neon_green', name: 'Neon Green', desc: 'Radioactive green glow', cost: 2000, type: 'color', value: '#39FF14', winsRequired: 0, special: true },
    'electric_blue': { id: 'electric_blue', name: 'Electric Blue', desc: 'Shocking electric blue', cost: 2500, type: 'color', value: '#7DF9FF', winsRequired: 0, special: true },
    'toxic_yellow': { id: 'toxic_yellow', name: 'Toxic Yellow', desc: 'Radioactive yellow', cost: 2500, type: 'color', value: '#DFFF00', winsRequired: 0, special: true },
    'magenta': { id: 'magenta', name: 'Magenta', desc: 'Vibrant magenta', cost: 3000, type: 'color', value: '#FF00FF', winsRequired: 0, special: true },
    'turquoise': { id: 'turquoise', name: 'Turquoise', desc: 'Tropical turquoise', cost: 3000, type: 'color', value: '#40E0D0', winsRequired: 0, special: true },

    // Very expensive (10000+ pts)
    'gold': { id: 'gold', name: 'Gold', desc: 'Shine like a champion', cost: 10000, type: 'color', value: '#FFD700', winsRequired: 0, special: true },
    'silver': { id: 'silver', name: 'Silver', desc: 'Metallic silver shine', cost: 15000, type: 'color', value: '#C0C0C0', winsRequired: 0, special: true },
    'platinum': { id: 'platinum', name: 'Platinum', desc: 'Ultra rare platinum', cost: 25000, type: 'color', value: '#E5E4E2', winsRequired: 0, legendary: true },
    'obsidian': { id: 'obsidian', name: 'Obsidian', desc: 'Dark volcanic glass', cost: 30000, type: 'color', value: '#0B1215', winsRequired: 0, legendary: true },
    'rainbow': { id: 'rainbow', name: 'Rainbow', desc: 'Animated rainbow effect', cost: 50000, type: 'color', value: 'rainbow', winsRequired: 0, legendary: true },

    // Ultra expensive (75000-100000+ pts)
    'cosmic': { id: 'cosmic', name: '🌌 Cosmic', desc: 'Stars and galaxies', cost: 75000, type: 'color', value: '#4B0082', winsRequired: 0, legendary: true },
    'aurora': { id: 'aurora', name: '🌠 Aurora', desc: 'Northern lights effect', cost: 100000, type: 'color', value: '#00FF7F', winsRequired: 0, legendary: true },
    'void': { id: 'void', name: '⚫ Void', desc: 'Darkness incarnate', cost: 150000, type: 'color', value: '#000000', winsRequired: 0, legendary: true },

    // More premium colors (500-1000 pts)
    'lavender': { id: 'lavender', name: 'Lavender', desc: 'Soft lavender purple', cost: 600, type: 'color', value: '#B57EDC', winsRequired: 0 },
    'peach': { id: 'peach', name: 'Peach', desc: 'Sweet peach color', cost: 650, type: 'color', value: '#FFDAB9', winsRequired: 0 },
    'mint': { id: 'mint', name: 'Mint', desc: 'Fresh mint green', cost: 700, type: 'color', value: '#98FF98', winsRequired: 0 },
    'coral': { id: 'coral', name: 'Coral', desc: 'Ocean coral pink', cost: 800, type: 'color', value: '#FF7F50', winsRequired: 0 },
    'violet': { id: 'violet', name: 'Violet', desc: 'Deep violet purple', cost: 850, type: 'color', value: '#8F00FF', winsRequired: 0 },
    'maroon': { id: 'maroon', name: 'Maroon', desc: 'Rich maroon red', cost: 900, type: 'color', value: '#800000', winsRequired: 0 },
    'navy': { id: 'navy', name: 'Navy', desc: 'Deep navy blue', cost: 950, type: 'color', value: '#000080', winsRequired: 0 },
    'rose': { id: 'rose', name: 'Rose', desc: 'Beautiful rose pink', cost: 1000, type: 'color', value: '#FF007F', winsRequired: 0 },

    // Win-based unlockables (require wins + points)
    'bronze': { id: 'bronze', name: '🥉 Bronze Medal', desc: 'Bronze achievement', cost: 1000, type: 'color', value: '#CD7F32', winsRequired: 5, special: true },
    'diamond': { id: 'diamond', name: '💎 Diamond Aura', desc: 'Sparkling diamond effect', cost: 5000, type: 'color', value: '#B9F2FF', winsRequired: 10, special: true },
    'fire': { id: 'fire', name: '🔥 Fire Champion', desc: 'Blazing fire effect', cost: 10000, type: 'color', value: '#FF4500', winsRequired: 25, special: true },
    'ice': { id: 'ice', name: '❄️ Ice Master', desc: 'Frozen ice effect', cost: 15000, type: 'color', value: '#B0E0E6', winsRequired: 40, special: true },
    'lightning': { id: 'lightning', name: '⚡ Lightning Legend', desc: 'Electric lightning aura', cost: 20000, type: 'color', value: '#FFFF00', winsRequired: 50, legendary: true },
    'shadow': { id: 'shadow', name: '👤 Shadow Master', desc: 'Master of shadows', cost: 30000, type: 'color', value: '#2F4F4F', winsRequired: 75, legendary: true },
    'celestial': { id: 'celestial', name: '✨ Celestial', desc: 'Blessed by the stars', cost: 50000, type: 'color', value: '#E6E6FA', winsRequired: 100, legendary: true }
};

// Render the shop with dynamic cosmetics (Organized into tabs)
function renderShop() {
    // Block shop for guest (anonymous) users
    if (typeof auth !== 'undefined' && auth && auth.currentUser && auth.currentUser.isAnonymous) {
        const containers = ['shopColorsBasic', 'shopColorsPremium', 'shopUnlockables', 'shopOther'];
        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '';
        });
        const basicContainer = document.getElementById('shopColorsBasic');
        if (basicContainer) {
            const lock = document.createElement('div');
            lock.className = 'shop-guest-lock';
            const icon = document.createElement('div');
            icon.className = 'shop-guest-lock-icon';
            icon.textContent = '🔒';
            const title = document.createElement('h3');
            title.textContent = 'Shop requires an account';
            const text = document.createElement('p');
            text.textContent = 'Create a free account to buy cosmetics and support the game.';
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = 'Create a free account';
            btn.addEventListener('click', signOutUser);
            lock.appendChild(icon);
            lock.appendChild(title);
            lock.appendChild(text);
            lock.appendChild(btn);
            basicContainer.appendChild(lock);
        }
        return;
    }

    try {
        console.log('🛒 Rendering shop...');
        console.log('Player data:', playerData);

        // Update stats display
        const pointsEl = document.getElementById('shopPointsDisplay');
        const winsEl = document.getElementById('shopWinsDisplay');

        console.log('Stats elements:', { pointsEl, winsEl });

        if (pointsEl) pointsEl.textContent = playerData.points.toLocaleString();
        if (winsEl) winsEl.textContent = (playerData.wins || 0).toString();

        // Get containers
        const basicContainer = document.getElementById('shopColorsBasic');
        const premiumContainer = document.getElementById('shopColorsPremium');
        const unlockablesContainer = document.getElementById('shopUnlockables');
        const otherContainer = document.getElementById('shopOther');

        console.log('Shop containers:', {
            basic: !!basicContainer,
            premium: !!premiumContainer,
            unlockables: !!unlockablesContainer,
            other: !!otherContainer
        });

        if (!basicContainer || !premiumContainer || !unlockablesContainer || !otherContainer) {
            console.error('❌ Shop containers not found!');
            console.error('Missing:', {
                basic: !basicContainer,
                premium: !premiumContainer,
                unlockables: !unlockablesContainer,
                other: !otherContainer
            });
            return;
        }

        // Clear all containers
        basicContainer.innerHTML = '';
        premiumContainer.innerHTML = '';
        unlockablesContainer.innerHTML = '';
        otherContainer.innerHTML = '';
        console.log('✅ Containers cleared');

        // Helper function to create cosmetic HTML
        function createCosmeticHTML(cosmetic) {
        const isOwned = (playerData.ownedCosmetics || []).includes(cosmetic.id);
        const isEquipped = playerData.equippedCosmetic === cosmetic.id;
        const hasWins = (playerData.wins || 0) >= cosmetic.winsRequired;
        const isLocked = cosmetic.winsRequired > 0 && !hasWins;

        let itemClass = 'shop-item';
        if (cosmetic.cost <= 150) itemClass += ' affordable';
        if (cosmetic.special) itemClass += ' special';
        if (cosmetic.legendary) itemClass += ' legendary';
        if (isLocked) itemClass += ' locked';

        // Determine button text and action
        let buttonText, buttonAction, buttonClass;
        if (isLocked) {
            buttonText = `🔒 ${cosmetic.winsRequired} Wins`;
            buttonAction = `alert('Win ${cosmetic.winsRequired} games to unlock this!')`;
            buttonClass = 'btn btn-secondary btn-small';
        } else if (isEquipped) {
            buttonText = '✓ Equipped';
            buttonAction = ``;
            buttonClass = 'btn btn-success btn-small';
        } else if (isOwned) {
            buttonText = 'Equip?';
            buttonAction = `equipCosmetic('${cosmetic.id}')`;
            buttonClass = 'btn btn-primary btn-small';
        } else {
            buttonText = 'Buy';
            buttonAction = `purchaseCosmetic('${cosmetic.id}')`;
            buttonClass = 'btn btn-primary btn-small';
        }

        // Create visual indicator
        let iconHTML;
        if (cosmetic.type === 'color') {
            if (cosmetic.value === 'gold') {
                iconHTML = '<div class="shop-item-icon gold-icon"></div>';
            } else if (cosmetic.value === 'rainbow') {
                iconHTML = '<div class="shop-item-icon rainbow-icon"></div>';
            } else {
                iconHTML = `<div class="shop-item-icon" style="background: ${cosmetic.value};"></div>`;
            }
        }

        return `
            <div class="${itemClass}">
                ${iconHTML}
                <div class="shop-item-info">
                    <h3>${cosmetic.name}</h3>
                    <p>${cosmetic.desc}</p>
                    ${isLocked ? `<p class="unlock-req">🏆 Win ${cosmetic.winsRequired} games to unlock</p>` : ''}
                </div>
                <div class="shop-item-price">${cosmetic.cost.toLocaleString()} pts</div>
                <button class="${buttonClass}" ${buttonAction ? `onclick="${buttonAction}"` : 'disabled'}>${buttonText}</button>
            </div>
        `;
    }

    // Sort cosmetics into categories
    console.log('COSMETICS object:', COSMETICS);
    const cosmeticsList = Object.values(COSMETICS);
    console.log(`Found ${cosmeticsList.length} cosmetics`);

    let basicCount = 0;
    let premiumCount = 0;
    let unlockableCount = 0;

    cosmeticsList.forEach(cosmetic => {
        const html = createCosmeticHTML(cosmetic);

        // Win-based unlockables (check first, regardless of cost)
        if (cosmetic.winsRequired > 0) {
            unlockablesContainer.insertAdjacentHTML('beforeend', html);
            unlockableCount++;
            console.log('Added unlockable:', cosmetic.name);
        }
        // Basic colors (no wins required, cost <= 500)
        else if (cosmetic.winsRequired === 0 && cosmetic.cost <= 500) {
            basicContainer.insertAdjacentHTML('beforeend', html);
            basicCount++;
            console.log('Added basic color:', cosmetic.name);
        }
        // Premium colors (no wins required, expensive > 500)
        else if (cosmetic.winsRequired === 0 && cosmetic.cost > 500) {
            premiumContainer.insertAdjacentHTML('beforeend', html);
            premiumCount++;
            console.log('Added premium color:', cosmetic.name);
        }
    });

    console.log(`✅ Shop rendering complete: ${basicCount} basic, ${premiumCount} premium, ${unlockableCount} unlockables`);

    // Add username change and custom color picker to "Other" tab
    otherContainer.innerHTML = `
        <div class="shop-item">
            <div class="shop-item-icon">✏️</div>
            <div class="shop-item-info">
                <h3>Change Username</h3>
                <p>Choose a new username</p>
            </div>
            <div class="shop-item-price">1,000 pts</div>
            <button class="btn btn-primary btn-small" onclick="openUsernameChange()">Buy</button>
        </div>

        <div class="shop-item">
            <div class="shop-item-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"></div>
            <div class="shop-item-info">
                <h3>Custom Color Picker</h3>
                <p>Choose any color you like</p>
            </div>
            <div class="shop-item-price">5,000 pts</div>
            <button class="btn btn-primary btn-small" onclick="openColorPicker()">Buy</button>
        </div>
    `;

        // Setup tab switching (if not already done)
        setupShopTabs();

        console.log('🎉 Shop rendering completed successfully!');
    } catch (error) {
        console.error('❌ FATAL Error rendering shop:', error);
        console.error('Error stack:', error.stack);
        alert('Error loading shop. Check console for details.');
    }
}

// Setup shop tab switching
let shopTabsInitialized = false;

function setupShopTabs() {
    if (shopTabsInitialized) return; // Only initialize once

    console.log('📑 Setting up shop tabs...');
    const tabs = document.querySelectorAll('.shop-tab');

    if (tabs.length === 0) {
        console.warn('⚠️ No shop tabs found');
        return;
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            console.log('Tab clicked:', targetTab);

            // Remove active from all tabs
            document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.shop-tab-content').forEach(c => c.classList.remove('active'));

            // Add active to clicked tab
            this.classList.add('active');

            // Show corresponding content
            const tabMap = {
                'colors': 'shopColorsTab',
                'premium': 'shopPremiumTab',
                'unlockables': 'shopUnlockablesTab',
                'other': 'shopOtherTab'
            };

            const contentId = tabMap[targetTab];
            if (contentId) {
                const contentEl = document.getElementById(contentId);
                if (contentEl) {
                    contentEl.classList.add('active');
                    console.log('✅ Showed tab:', contentId);
                }
            }
        });
    });

    shopTabsInitialized = true;
    console.log('✅ Shop tabs initialized');
}

// Purchase a cosmetic
function purchaseCosmetic(cosmeticId) {
    const cosmetic = COSMETICS[cosmeticId];
    if (!cosmetic) return;

    // Check if already owned
    if ((playerData.ownedCosmetics || []).includes(cosmeticId)) {
        alert('You already own this cosmetic!');
        return;
    }

    // Check wins requirement
    if ((playerData.wins || 0) < cosmetic.winsRequired) {
        showNotification('Locked', `Win ${cosmetic.winsRequired} games to unlock!`, '🔒');
        return;
    }

    // Check points
    if (playerData.points < cosmetic.cost) {
        showNotification('Not Enough Points', `You need ${cosmetic.cost.toLocaleString()} points`, '❌');
        return;
    }

    if (confirm(`Purchase ${cosmetic.name} for ${cosmetic.cost.toLocaleString()} points?`)) {
        // Deduct points
        playerData.points -= cosmetic.cost;

        // Add to owned cosmetics
        if (!playerData.ownedCosmetics) playerData.ownedCosmetics = [];
        playerData.ownedCosmetics.push(cosmeticId);

        // Equip it immediately
        playerData.equippedCosmetic = cosmeticId;
        playerData.color = cosmetic.value;

        savePlayerData();
        updatePlayerDisplay();

        // Update shop display
        document.getElementById('shopPointsDisplay').textContent = playerData.points.toLocaleString();
        renderShop();

        showNotification('Purchase Successful!', `${cosmetic.name} equipped!`, '✨');
    }
}

// Equip an owned cosmetic
function equipCosmetic(cosmeticId) {
    const cosmetic = COSMETICS[cosmeticId];
    if (!cosmetic) return;

    // Check if owned
    if (!(playerData.ownedCosmetics || []).includes(cosmeticId)) {
        alert('You don\'t own this cosmetic!');
        return;
    }

    // Equip it
    playerData.equippedCosmetic = cosmeticId;
    playerData.color = cosmetic.value;

    savePlayerData();
    updatePlayerDisplay();
    renderShop();

    showNotification('Equipped!', `${cosmetic.name} equipped!`, '✨');
}

// Shop functions
function openUsernameChange() {
    if (playerData.points < 1000) {
        alert('Not enough points! You need 1,000 points.');
        return;
    }
    document.getElementById('usernameModal').classList.add('active');
    document.getElementById('newUsernameInput').focus();
}

function openColorPicker() {
    if (playerData.points < 5000) {
        alert('Not enough points! You need 5,000 points.');
        return;
    }
    document.getElementById('colorModal').classList.add('active');
    updateColorPreview();
}

function updateColorPreview() {
    const color = document.getElementById('colorPicker').value;
    document.getElementById('colorPreview').style.background = color;
}

function confirmUsernameChange() {
    const newUsername = document.getElementById('newUsernameInput').value.trim();

    if (newUsername.length < 2) {
        alert('Username must be at least 2 characters long');
        return;
    }

    playerData.points -= 1000;
    const oldUsername = playerData.username;
    playerData.username = newUsername;
    savePlayerData();
    updatePlayerDisplay();

    // Update username in Firebase
    if (isFirebaseReady && typeof auth !== 'undefined' && auth && auth.currentUser) {
        const uid = auth.currentUser.uid;
        // Update users/{uid}/username, usernames/{uid}, and remove old references
        Promise.all([
            database.ref('users/' + uid + '/username').set(newUsername),
            database.ref('usernames/' + uid).set(newUsername)
        ]).catch(e => console.warn('Username update in Firebase failed:', e));
    }

    closeModal();
    alert('Username changed successfully!');
}

function confirmColorChange() {
    const color = document.getElementById('colorPicker').value;

    playerData.points -= 5000;
    playerData.color = color;
    savePlayerData();
    updatePlayerDisplay();
    closeModal();
    alert('Color changed successfully!');
}

function purchaseColor(colorType, customCost = null) {
    let cost = 0;
    let colorValue = '';
    let colorName = '';

    // v1.5: Support direct hex color purchases
    if (colorType.startsWith('#')) {
        cost = customCost || 100;
        colorValue = colorType;
        colorName = `this color`;
    } else if (colorType === 'gold') {
        cost = 10000;
        colorValue = 'gold';
        colorName = 'Gold';
    } else if (colorType === 'rainbow') {
        cost = 50000;
        colorValue = 'rainbow';
        colorName = 'Rainbow';
    }

    if (playerData.points < cost) {
        showNotification('Not Enough Points', `You need ${cost.toLocaleString()} points`, '❌');
        return;
    }

    if (confirm(`Purchase ${colorName} color for ${cost.toLocaleString()} points?`)) {
        playerData.points -= cost;
        playerData.color = colorValue;
        savePlayerData();
        updatePlayerDisplay();

        // Update shop points display
        const shopPointsEl = document.getElementById('shopPointsDisplay');
        if (shopPointsEl) {
            shopPointsEl.textContent = playerData.points.toLocaleString();
        }

        showNotification('Purchase Successful!', `${colorName} color equipped!`, '✨');
    }
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// v1.5 - Cancel search (smart navigation based on search type)
function cancelSearch() {
    console.log('🚫 Search cancelled by user');

    // Remove from waiting queue (all modes)
    if (database && playerData.id) {
        database.ref(`waiting_1v1/${playerData.id}`).remove();
        database.ref(`waiting_trios/${playerData.id}`).remove();
        database.ref(`waiting_squad/${playerData.id}`).remove();
        database.ref(`waiting_chat/${playerData.id}`).remove();
        // RPS queues
        database.ref(`waiting_rps1v1/${playerData.id}`).remove();
        database.ref(`waiting_rps1v2/${playerData.id}`).remove();
        database.ref(`waiting_rps1v3/${playerData.id}`).remove();
        // War queues
        database.ref(`waiting_war1v1/${playerData.id}`).remove();
    }

    // Remove game listeners
    if (searchListener) {
        database.ref('games').off('child_added', searchListener);
        database.ref('games_trios').off('child_added', searchListener);
        database.ref('games_squad').off('child_added', searchListener);
        searchListener = null;
    }

    // Remove RPS listeners
    if (rpsSearchListener) {
        database.ref('games_rps').off('child_added', rpsSearchListener);
        rpsSearchListener = null;
    }

    // Remove War listeners
    if (warSearchListener) {
        database.ref('waiting_war1v1').off('child_added', warSearchListener);
        warSearchListener = null;
    }

    // Remove chat listeners
    if (chatSearchListener) {
        database.ref('chats').off('child_added', chatSearchListener);
        chatSearchListener = null;
    }

    // Reset searching text
    document.querySelector('.searching-animation h2').textContent = 'Finding Opponent...';
    document.querySelector('.searching-text').textContent = 'Matching you with another player';

    // v1.5: Smart navigation based on what was being searched for
    if (currentSearchType === 'chat') {
        console.log('📱 Returning to Social (AI Chat tab)');
        showScreen('socialScreen');
        document.getElementById('chatTabBtn')?.classList.add('active');
        document.getElementById('friendsTabBtn')?.classList.remove('active');
        const chatTab = document.getElementById('chatTabContent');
        const friendsTab = document.getElementById('friendsTabContent');
        if (chatTab) chatTab.style.display = 'block';
        if (friendsTab) friendsTab.style.display = 'none';
        initAIChat();
    } else if (currentMode && (currentMode.startsWith('rps'))) {
        console.log('✊ Returning to RPS Mode selection');
        showScreen('rpsModeScreen');
    } else if (currentMode && (currentMode.startsWith('war'))) {
        console.log('🃏 Returning to War Mode selection');
        showScreen('warModeScreen');
    } else {
        console.log('🎮 Returning to Math Mode selection');
        showScreen('mathModeScreen');
    }

    // Reset search type
    currentSearchType = 'game';
}

// ===== WHO AM I GAME FUNCTIONS =====

// Detect if device is mobile
function detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
}

// Request device orientation permission (iOS 13+)
async function requestOrientationPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            return permission === 'granted';
        } catch (error) {
            console.error('Error requesting orientation permission:', error);
            return false;
        }
    }
    return true; // No permission needed on Android
}

// Start Who Am I game
async function startWhoAmIGame() {
    if (!detectMobile()) {
        alert('📱 Who Am I mode is only available on mobile devices!');
        showScreen('menuScreen');
        return;
    }

    // Request orientation permission
    const hasPermission = await requestOrientationPermission();
    if (!hasPermission) {
        alert('Please allow device orientation access to play this mode.');
        showScreen('menuScreen');
        return;
    }

    // Initialize game
    whoAmIWords = generateWhoAmIWords();
    whoAmICurrentWordIndex = 0;
    whoAmICorrect = 0;
    whoAmIWrong = 0;

    showScreen('whoAmIScreen');
    updateWhoAmIDisplay();
    startWhoAmITimer();
    setupOrientationListener();
}

// Update Who Am I display
function updateWhoAmIDisplay() {
    if (whoAmICurrentWordIndex < whoAmIWords.length) {
        document.getElementById('whoamiWord').textContent = whoAmIWords[whoAmICurrentWordIndex];
        document.getElementById('whoamiWordNum').textContent = whoAmICurrentWordIndex + 1;
    } else {
        endWhoAmIGame();
    }

    document.getElementById('whoamiCorrect').textContent = whoAmICorrect;
    document.getElementById('whoamiWrong').textContent = whoAmIWrong;
}

// Start Who Am I timer (60 seconds)
function startWhoAmITimer() {
    timeRemaining = 60;
    updateWhoAmITimerDisplay();

    if (whoAmITimer) {
        clearInterval(whoAmITimer);
    }

    whoAmITimer = setInterval(() => {
        timeRemaining--;
        updateWhoAmITimerDisplay();

        if (timeRemaining <= 0) {
            clearInterval(whoAmITimer);
            endWhoAmIGame();
        }
    }, 1000);
}

// Update Who Am I timer display
function updateWhoAmITimerDisplay() {
    const timerElement = document.getElementById('whoamiTimer');
    if (!timerElement) return;

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const secondsStr = seconds < 10 ? '0' + seconds : seconds;
    timerElement.textContent = minutes + ':' + secondsStr;
}

// Setup orientation listener
function setupOrientationListener() {
    let lastTilt = 0;
    const tiltThreshold = 30; // Degrees to trigger

    orientationListener = (event) => {
        const beta = event.beta; // Front-to-back tilt (-180 to 180)

        // Tilt UP (phone tilted back) = Correct
        if (beta < -tiltThreshold && lastTilt >= -tiltThreshold) {
            handleWhoAmICorrect();
        }
        // Tilt DOWN (phone tilted forward) = Wrong/Skip
        else if (beta > tiltThreshold && lastTilt <= tiltThreshold) {
            handleWhoAmIWrong();
        }

        lastTilt = beta;
    };

    window.addEventListener('deviceorientation', orientationListener);
}

// Handle correct answer
function handleWhoAmICorrect() {
    whoAmICorrect++;
    whoAmICurrentWordIndex++;

    // Vibrate for feedback (if supported)
    if (navigator.vibrate) {
        navigator.vibrate(100);
    }

    updateWhoAmIDisplay();
}

// Handle wrong/skip answer
function handleWhoAmIWrong() {
    whoAmIWrong++;
    whoAmICurrentWordIndex++;

    // Vibrate for feedback (if supported)
    if (navigator.vibrate) {
        navigator.vibrate([50, 50, 50]);
    }

    updateWhoAmIDisplay();
}

// End Who Am I game
function endWhoAmIGame() {
    // Stop timer
    if (whoAmITimer) {
        clearInterval(whoAmITimer);
    }

    // Remove orientation listener
    if (orientationListener) {
        window.removeEventListener('deviceorientation', orientationListener);
        orientationListener = null;
    }

    // Show results
    alert(`Game Over!\n\nCorrect: ${whoAmICorrect}\nWrong/Skipped: ${whoAmIWrong}\n\nScore: ${whoAmICorrect * 10} points`);

    // Award points
    playerData.points += whoAmICorrect * 10;
    savePlayerData();
    updatePlayerDisplay();

    showScreen('menuScreen');
}

// ===== CHAT MODE FUNCTIONS =====

// v1.5 - Destroy current chat completely
async function destroyCurrentChat() {
    console.log('🗑️ Destroying current chat session...');

    // Remove all listeners
    if (chatListener) {
        database.ref(`chats/${currentChatSession.chatId}/messages`).off('child_added', chatListener);
        chatListener = null;
    }

    if (chatSearchListener) {
        database.ref('chats').off('child_added', chatSearchListener);
        chatSearchListener = null;
    }

    // Mark chat as inactive in database
    if (currentChatSession.chatId) {
        try {
            await database.ref(`chats/${currentChatSession.chatId}/active`).set(false);
            await database.ref(`chats/${currentChatSession.chatId}`).remove(); // Delete the whole chat
        } catch (error) {
            console.warn('⚠️ Could not destroy chat:', error);
        }
    }

    // Remove from waiting
    try {
        await database.ref(`waiting_chat/${playerData.id}`).remove();
    } catch (error) {
        console.warn('⚠️ Could not remove from waiting:', error);
    }

    // Reset session
    currentChatSession = {
        chatId: '',
        partnerId: '',
        partnerUsername: '',
        partnerColor: '',
        partnerLeft: false
    };

    console.log('✅ Chat session destroyed');
}

// v1.5 - Completely rebuilt chat system
async function findChatPartner() {
    try {
        // Track that we're searching for chat (for cancel button)
        currentSearchType = 'chat';

        // Clean up any existing chat session first
        await destroyCurrentChat();

        showScreen('searchingScreen');
        document.querySelector('.searching-animation h2').textContent = 'Finding Chat Partner...';
        document.querySelector('.searching-text').textContent = 'Matching you with someone to chat';

        const waitingRef = database.ref('waiting_chat');
        const snapshot = await waitingRef.once('value');
        const waiting = snapshot.val() || {};

        // Clean up stale entries
        const now = Date.now();
        Object.keys(waiting).forEach(key => {
            if (waiting[key] && now - waiting[key].timestamp > 30000) {
                waitingRef.child(key).remove();
            }
        });

        // Check for available chat partner
        const freshSnapshot = await waitingRef.once('value');
        const freshWaiting = freshSnapshot.val() || {};
        const availablePartners = Object.entries(freshWaiting).filter(([id]) => id !== playerData.id);

        if (availablePartners.length > 0) {
            // Partner found!
            const [partnerId, partnerData] = availablePartners[0];
            console.log('✅ Chat partner found:', partnerData.username);

            showNotification('Partner Found!', `Connecting with ${partnerData.username}`, '💬');

            // Remove both from waiting
            await waitingRef.child(partnerId).remove();
            await waitingRef.child(playerData.id).remove();

            // Create chat session
            const chatId = generateId();
            const chatData = {
                id: chatId,
                user1: {
                    id: playerData.id,
                    username: playerData.username,
                    color: playerData.color,
                    level: playerData.level || 1
                },
                user2: {
                    id: partnerId,
                    username: partnerData.username,
                    color: partnerData.color,
                    level: partnerData.level || 1
                },
                messages: [],
                createdAt: Date.now(),
                active: true
            };

            await database.ref(`chats/${chatId}`).set(chatData);
            startChatSession(chatId, chatData);
        } else {
            // Add self to waiting
            console.log('⏳ Waiting for chat partner...');
            await waitingRef.child(playerData.id).set({
                username: playerData.username,
                color: playerData.color,
                level: playerData.level || 1,
                timestamp: Date.now()
            });

            // Listen for chat creation
            chatSearchListener = database.ref('chats').on('child_added', (snapshot) => {
                const chat = snapshot.val();
                if (chat && (chat.user1.id === playerData.id || chat.user2.id === playerData.id)) {
                    console.log('✅ Joined chat!');
                    if (chatSearchListener) {
                        database.ref('chats').off('child_added', chatSearchListener);
                        chatSearchListener = null;
                    }
                    database.ref(`waiting_chat/${playerData.id}`).remove();
                    startChatSession(chat.id, chat);
                }
            });
        }
    } catch (error) {
        console.error('❌ Chat matching error:', error);
        alert('Failed to find chat partner: ' + error.message);
        showScreen('menuScreen');
    }
}

// v1.5 - Fixed startChatSession (prevents duplication)
function startChatSession(chatId, chatData) {
    // Clean up any previous listeners first (critical!)
    if (chatListener) {
        database.ref(`chats/${currentChatSession.chatId}/messages`).off('child_added', chatListener);
        chatListener = null;
    }

    currentChatSession.chatId = chatId;
    currentChatSession.partnerLeft = false;

    const isUser1 = chatData.user1.id === playerData.id;
    const partner = isUser1 ? chatData.user2 : chatData.user1;

    currentChatSession.partnerId = partner.id;
    currentChatSession.partnerUsername = partner.username;
    currentChatSession.partnerColor = partner.color;
    currentChatSession.partnerLevel = partner.level || 1;

    showScreen('chatScreen');

    // Update partner display with level
    document.getElementById('chatPartnerName').innerHTML = partner.username + getLevelDisplay(partner.level || 1);
    document.getElementById('chatStatus').textContent = 'Online';

    const partnerAvatar = document.getElementById('chatPartnerAvatar');
    applyAvatarStyle(partnerAvatar, partner.color);

    // Clear messages
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '<div class="chat-welcome">Say hello to ' + partner.username + '!</div>';

    // Show/hide Add Friend button
    const addFriendBtn = document.getElementById('addFriendBtn');
    if (playerData.friends.includes(partner.id)) {
        addFriendBtn.style.display = 'none';
    } else {
        addFriendBtn.style.display = 'block';
    }

    // Re-enable chat input
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendMessageBtn');

    chatInput.disabled = false;
    chatInput.placeholder = 'Type a message...';
    chatInput.style.background = '';
    chatInput.style.cursor = '';
    chatInput.value = '';
    chatInput.focus();

    sendBtn.disabled = false;
    sendBtn.style.opacity = '';
    sendBtn.style.cursor = '';

    // v1.5 FIX: Track displayed message IDs to prevent duplication
    const displayedMessageIds = new Set();

    // Listen for new messages (ONLY ONCE!)
    chatListener = database.ref(`chats/${chatId}/messages`).on('child_added', (snapshot) => {
        const messageId = snapshot.key;
        const message = snapshot.val();

        // Only display if we haven't seen this message before
        if (message && !displayedMessageIds.has(messageId)) {
            displayedMessageIds.add(messageId);
            displayChatMessage(message);
        }
    });

    // Listen for partner leaving
    database.ref(`chats/${chatId}/active`).on('value', (snapshot) => {
        if (snapshot.val() === false && !currentChatSession.partnerLeft) {
            handlePartnerLeft();
        }
    });

    console.log('✅ Chat session started with:', partner.username);
}

// Display chat message
function displayChatMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');

    const isMe = message.senderId === playerData.id;
    messageDiv.className = `chat-message ${isMe ? 'mine' : 'theirs'}`;

    const senderName = isMe ? 'You' : currentChatSession.partnerUsername;
    const senderLevel = isMe ? playerData.level : currentChatSession.partnerLevel;

    messageDiv.innerHTML = `
        <div class="message-sender">${senderName} ${getLevelDisplay(senderLevel)}</div>
        <div class="message-text">${escapeHtml(message.text)}</div>
        <div class="message-time">${formatTime(message.timestamp)}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Display system message in chat
function displaySystemMessage(text) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');

    messageDiv.className = 'chat-message system';
    messageDiv.style.textAlign = 'center';
    messageDiv.style.margin = '20px auto';
    messageDiv.style.maxWidth = '80%';
    messageDiv.style.background = 'rgba(102, 126, 234, 0.1)';
    messageDiv.style.border = '1px solid rgba(102, 126, 234, 0.3)';
    messageDiv.style.padding = '12px 20px';
    messageDiv.style.borderRadius = '20px';
    messageDiv.style.color = '#667eea';
    messageDiv.style.fontWeight = '500';

    messageDiv.innerHTML = `
        <div class="message-text">${escapeHtml(text)}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send chat message
async function sendChatMessage() {
    const input = document.getElementById('chatInput');

    // Don't send if input is disabled (partner left)
    if (input.disabled) {
        console.log('💬 Cannot send message - partner has left');
        return;
    }

    const text = input.value.trim();

    if (!text) return;
    if (text.length > MAX_CHAT_MESSAGE_LENGTH) {
        alert(`Message too long. Maximum ${MAX_CHAT_MESSAGE_LENGTH} characters.`);
        return;
    }

    const message = {
        senderId: playerData.id,
        senderUsername: playerData.username,
        text: text,
        timestamp: Date.now()
    };

    try {
        await database.ref(`chats/${currentChatSession.chatId}/messages`).push(message);
        input.value = '';
        input.focus();
    } catch (error) {
        console.error('❌ Failed to send message:', error);
        alert('Failed to send message');
    }
}

// v1.5 - Fixed skip (destroys chat and finds new partner)
async function skipChatPartner() {
    console.log('⏭️ Skipping to next partner...');
    showNotification('Skipping', 'Finding you a new partner...', '⏭️');

    // Destroy current chat completely
    await destroyCurrentChat();

    // Find new partner (will go to loading if no one is waiting)
    await findChatPartner();
}

// v1.5 - Fixed leave (destroys chat and returns to menu)
async function leaveChat() {
    console.log('👋 Leaving chat...');

    // Destroy current chat completely
    await destroyCurrentChat();

    // Return to social screen with friends list
    showScreen('socialScreen');
    loadFriendsList();
}

// Handle partner left
function handlePartnerLeft() {
    // Don't process if already handled
    if (currentChatSession.partnerLeft) return;

    // Mark that partner has left
    currentChatSession.partnerLeft = true;

    // Display in-chat system message
    displaySystemMessage('Your chat partner has left the conversation.');

    // Disable chat input and send button
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendMessageBtn');

    if (chatInput) {
        chatInput.disabled = true;
        chatInput.placeholder = 'Chat partner has left...';
        chatInput.style.background = '#f5f5f5';
        chatInput.style.cursor = 'not-allowed';
    }

    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.5';
        sendBtn.style.cursor = 'not-allowed';
    }

    // Keep skip and leave buttons enabled (they still work)
    console.log('💬 Partner left - chat disabled, skip/leave still available');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format timestamp
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// ===== FRIEND SYSTEM FUNCTIONS =====

// Send friend request
async function sendFriendRequest() {
    const partnerId = currentChatSession.partnerId;
    const partnerUsername = currentChatSession.partnerUsername;
    const partnerColor = currentChatSession.partnerColor;

    try {
        // Add friend request to partner's list
        await database.ref(`users/${partnerId}/friendRequests/${playerData.id}`).set({
            id: playerData.id,
            username: playerData.username,
            color: playerData.color,
            timestamp: Date.now()
        });

        document.getElementById('addFriendBtn').textContent = 'Request Sent';
        document.getElementById('addFriendBtn').disabled = true;

        alert(`Friend request sent to ${partnerUsername}!`);
    } catch (error) {
        console.error('Error sending friend request:', error);
        alert('Failed to send friend request');
    }
}

// Load friends list
async function loadFriendsList() {
    try {
        const snapshot = await database.ref(`users/${playerData.id}/friends`).once('value');
        const friends = snapshot.val() || {};

        playerData.friends = Object.keys(friends);
        savePlayerData();

        updateFriendsDisplay(friends);
    } catch (error) {
        console.error('Error loading friends:', error);
    }
}

// Load friend requests
async function loadFriendRequests() {
    try {
        const snapshot = await database.ref(`users/${playerData.id}/friendRequests`).once('value');
        const requests = snapshot.val() || {};

        playerData.friendRequests = Object.keys(requests);
        savePlayerData();

        updateFriendRequestsDisplay(requests);
        updateRequestsCount(Object.keys(requests).length);
    } catch (error) {
        console.error('Error loading friend requests:', error);
    }
}

// Update friends display
function updateFriendsDisplay(friends) {
    const friendsList = document.getElementById('friendsList');
    friendsList.innerHTML = '';

    const friendsArray = Object.values(friends);

    // Update friends count if element exists
    const friendsCountEl = document.getElementById('friendsCount');
    if (friendsCountEl) {
        friendsCountEl.textContent = friendsArray.length;
    }

    if (friendsArray.length === 0) {
        friendsList.innerHTML = '<div class="empty-state">No friends yet. Add friends from chat!</div>';
        return;
    }

    friendsArray.forEach(friend => {
        const friendItem = document.createElement('div');
        friendItem.className = 'friend-item';

        // Check if friend is online
        database.ref(`online/${friend.id}`).once('value', (snapshot) => {
            const isOnline = snapshot.exists();
            const statusClass = isOnline ? '' : 'offline';
            const statusText = isOnline ? 'Online' : 'Offline';

            friendItem.innerHTML = `
                <div class="friend-info">
                    <div class="player-avatar" style="background: ${getColorStyle(friend.color)}"></div>
                    <div class="friend-details">
                        <div class="friend-name">${escapeHtml(friend.username)}</div>
                        <div class="friend-status ${statusClass}">${statusText}</div>
                    </div>
                </div>
                <div class="friend-actions">
                    <button class="btn btn-primary btn-small" onclick="inviteFriendTo1v1('${friend.id}', '${escapeHtml(friend.username)}')">⚔️ 1v1</button>
                    <button class="btn btn-primary btn-small" onclick="openFriendChat('${friend.id}')">💬 Chat</button>
                    <button class="btn btn-secondary btn-small" onclick="removeFriend('${friend.id}')">Remove</button>
                </div>
            `;
        });

        friendsList.appendChild(friendItem);
    });
}

// Update friend requests display
function updateFriendRequestsDisplay(requests) {
    const requestsList = document.getElementById('friendRequestsList');
    requestsList.innerHTML = '';

    const requestsArray = Object.values(requests);

    if (requestsArray.length === 0) {
        requestsList.innerHTML = '<div class="empty-state">No friend requests</div>';
        return;
    }

    requestsArray.forEach(request => {
        const requestItem = document.createElement('div');
        requestItem.className = 'friend-request-item';
        requestItem.innerHTML = `
            <div class="friend-info">
                <div class="player-avatar" style="background: ${getColorStyle(request.color)}"></div>
                <div class="friend-details">
                    <div class="friend-name">${escapeHtml(request.username)}</div>
                    <div class="friend-status">Wants to be friends</div>
                </div>
            </div>
            <div class="request-actions">
                <button class="btn btn-primary btn-small" onclick="acceptFriendRequest('${request.id}', '${escapeHtml(request.username)}', '${request.color}')">Accept</button>
                <button class="btn btn-secondary btn-small" onclick="rejectFriendRequest('${request.id}')">Reject</button>
            </div>
        `;
        requestsList.appendChild(requestItem);
    });
}

// Update requests count badge
function updateRequestsCount(count) {
    document.getElementById('requestsCount').textContent = count;
    if (count > 0) {
        document.getElementById('requestsCount').style.display = 'inline';
    } else {
        document.getElementById('requestsCount').style.display = 'none';
    }
}

// Accept friend request
async function acceptFriendRequest(friendId, friendUsername, friendColor) {
    try {
        // Add to my friends
        await database.ref(`users/${playerData.id}/friends/${friendId}`).set({
            id: friendId,
            username: friendUsername,
            color: friendColor
        });

        // Add me to their friends
        await database.ref(`users/${friendId}/friends/${playerData.id}`).set({
            id: playerData.id,
            username: playerData.username,
            color: playerData.color
        });

        // Remove friend request
        await database.ref(`users/${playerData.id}/friendRequests/${friendId}`).remove();

        alert(`You are now friends with ${friendUsername}!`);

        // Reload lists
        loadFriendsList();
        loadFriendRequests();
    } catch (error) {
        console.error('Error accepting friend request:', error);
        alert('Failed to accept friend request');
    }
}

// Reject friend request
async function rejectFriendRequest(friendId) {
    try {
        await database.ref(`users/${playerData.id}/friendRequests/${friendId}`).remove();
        loadFriendRequests();
    } catch (error) {
        console.error('Error rejecting friend request:', error);
    }
}

// Remove friend
async function removeFriend(friendId) {
    if (!confirm('Remove this friend?')) return;

    try {
        // Remove from my friends
        await database.ref(`users/${playerData.id}/friends/${friendId}`).remove();

        // Remove me from their friends
        await database.ref(`users/${friendId}/friends/${playerData.id}`).remove();

        loadFriendsList();
    } catch (error) {
        console.error('Error removing friend:', error);
        alert('Failed to remove friend');
    }
}

// Open friend chat
async function openFriendChat(friendId) {
    try {
        // Get friend data
        const snapshot = await database.ref(`users/${playerData.id}/friends/${friendId}`).once('value');
        const friend = snapshot.val();

        if (!friend) {
            alert('Friend not found');
            return;
        }

        // Create or get existing direct message channel
        const channelId = [playerData.id, friendId].sort().join('_');

        showScreen('friendChatScreen');

        // Update UI
        document.getElementById('friendChatName').textContent = friend.username;
        const friendChatAvatar = document.getElementById('friendChatAvatar');
        applyAvatarStyle(friendChatAvatar, friend.color);

        // Check if friend is online
        database.ref(`online/${friendId}`).on('value', (snapshot) => {
            const isOnline = snapshot.exists();
            const statusEl = document.getElementById('friendChatStatus');
            statusEl.textContent = isOnline ? 'Online' : 'Offline';
            statusEl.className = isOnline ? 'chat-status' : 'chat-status offline';

            const inviteBtn = document.getElementById('inviteFriendToGameBtn');
            if (inviteBtn) {
                inviteBtn.disabled = !isOnline;
                inviteBtn.style.opacity = isOnline ? '' : '0.5';
                inviteBtn.style.cursor = isOnline ? '' : 'not-allowed';
            }
        });

        // Clear previous messages
        const messagesDiv = document.getElementById('friendChatMessages');
        messagesDiv.innerHTML = '';

        // Load message history
        database.ref(`directMessages/${channelId}`).on('child_added', (snapshot) => {
            const message = snapshot.val();
            displayFriendMessage(message);
        });

        // Store current chat info for sending messages
        currentChatSession.chatId = channelId;
        currentChatSession.partnerId = friendId;
        currentChatSession.partnerUsername = friend.username;

    } catch (error) {
        console.error('Error opening friend chat:', error);
        alert('Failed to open chat');
    }
}

// Display friend message
function displayFriendMessage(message) {
    const messagesDiv = document.getElementById('friendChatMessages');
    const messageDiv = document.createElement('div');

    const isMe = message.senderId === playerData.id;
    messageDiv.className = `chat-message ${isMe ? 'mine' : 'theirs'}`;

    messageDiv.innerHTML = `
        <div class="message-sender">${isMe ? 'You' : currentChatSession.partnerUsername}</div>
        <div class="message-text">${escapeHtml(message.text)}</div>
        <div class="message-time">${formatTime(message.timestamp)}</div>
    `;

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Send friend message
async function sendFriendMessage() {
    const input = document.getElementById('friendChatInput');
    const text = input.value.trim();

    if (!text) return;

    const message = {
        senderId: playerData.id,
        senderUsername: playerData.username,
        text: text,
        timestamp: Date.now()
    };

    try {
        await database.ref(`directMessages/${currentChatSession.chatId}`).push(message);
        input.value = '';
        input.focus();
    } catch (error) {
        console.error('Failed to send message:', error);
        alert('Failed to send message');
    }
}

// v1.5: Invite friend to 1v1 game
async function inviteFriendTo1v1(friendId, friendUsername) {
    try {
        // Check if friend is online
        const onlineSnapshot = await database.ref(`online/${friendId}`).once('value');
        if (!onlineSnapshot.exists()) {
            showNotification('Friend Offline', `${friendUsername} is not online right now`, '😔');
            return;
        }

        // Create game invite
        const inviteId = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await database.ref(`gameInvites/${friendId}/${inviteId}`).set({
            from: playerData.id,
            fromUsername: playerData.username,
            fromColor: playerData.color,
            mode: '1v1',
            timestamp: Date.now()
        });

        showNotification('Invite Sent!', `Waiting for ${friendUsername} to accept...`, '⚔️');

        // Listen for invite acceptance
        const inviteRef = database.ref(`gameInvites/${friendId}/${inviteId}`);
        inviteRef.on('value', async (snapshot) => {
            const invite = snapshot.val();
            if (invite && invite.accepted) {
                // Clean up listener
                inviteRef.off();

                // Create the game
                const gameId = invite.gameId;
                showNotification('Invite Accepted!', 'Starting game...', '🎮');

                setTimeout(() => {
                    database.ref(`games/${gameId}`).once('value', (gameSnapshot) => {
                        const game = gameSnapshot.val();
                        if (game) {
                            startGame(gameId, game);
                        }
                    });
                }, 1000);
            }
        });

    } catch (error) {
        console.error('Failed to send invite:', error);
        showNotification('Invite Failed', 'Could not send game invite', '❌');
    }
}

// v1.5: Listen for incoming friend requests (real-time)
let currentFriendRequest = null;

function setupFriendRequestListener() {
    if (!database || !playerData.id) return;

    database.ref(`users/${playerData.id}/friendRequests`).on('child_added', (snapshot) => {
        const requestId = snapshot.key;
        const request = snapshot.val();

        // Don't show if it's an old request (loaded on init)
        if (Date.now() - request.timestamp > 5000) {
            // Just update the badge
            loadFriendRequests();
            return;
        }

        // Show in-app notification
        showFriendRequestNotification(requestId, request);
    });
}

function showFriendRequestNotification(requestId, request) {
    currentFriendRequest = { id: requestId, data: request };

    const notif = document.getElementById('friendRequestNotification');
    const usernameEl = notif.querySelector('.friend-request-username');

    if (usernameEl) {
        usernameEl.textContent = request.username;
    }

    notif.style.display = 'block';

    // Update badge count
    loadFriendRequests();

    // Auto-hide after 10 seconds if not interacted with
    setTimeout(() => {
        if (notif.style.display === 'block') {
            notif.style.display = 'none';
            currentFriendRequest = null;
        }
    }, 10000);
}

function hideFriendRequestNotification() {
    const notif = document.getElementById('friendRequestNotification');
    notif.style.display = 'none';
    currentFriendRequest = null;
}

async function acceptFriendRequestFromNotification() {
    if (!currentFriendRequest) return;

    const { id: friendId, data: friendData } = currentFriendRequest;

    try {
        // Add to my friends
        await database.ref(`users/${playerData.id}/friends/${friendId}`).set({
            id: friendId,
            username: friendData.username,
            color: friendData.color
        });

        // Add me to their friends
        await database.ref(`users/${friendId}/friends/${playerData.id}`).set({
            id: playerData.id,
            username: playerData.username,
            color: playerData.color
        });

        // Remove friend request
        await database.ref(`users/${playerData.id}/friendRequests/${friendId}`).remove();

        hideFriendRequestNotification();
        showNotification('Friend Added!', `You are now friends with ${friendData.username}`, '🎉');

        // Reload lists
        loadFriendsList();
        loadFriendRequests();
    } catch (error) {
        console.error('Error accepting friend request:', error);
        showNotification('Error', 'Failed to accept friend request', '❌');
    }
}

async function rejectFriendRequestFromNotification() {
    if (!currentFriendRequest) return;

    const { id: friendId } = currentFriendRequest;

    try {
        await database.ref(`users/${playerData.id}/friendRequests/${friendId}`).remove();
        hideFriendRequestNotification();
        showNotification('Request Rejected', 'Friend request declined', 'ℹ️');
        loadFriendRequests();
    } catch (error) {
        console.error('Error rejecting friend request:', error);
    }
}

// Listen for incoming game invites
let currentGameInvite = null;

function setupGameInviteListener() {
    if (!database || !playerData.id) return;

    database.ref(`gameInvites/${playerData.id}`).on('child_added', async (snapshot) => {
        const inviteId = snapshot.key;
        const invite = snapshot.val();

        // Skip if already accepted or expired (older than 2 minutes)
        if (invite.accepted || Date.now() - invite.timestamp > 120000) {
            await database.ref(`gameInvites/${playerData.id}/${inviteId}`).remove();
            return;
        }

        // Don't show if it's an old invite (loaded on init)
        if (Date.now() - invite.timestamp > 5000) {
            return;
        }

        // Show in-app notification
        showGameInviteNotification(inviteId, invite);
    });
}

function showGameInviteNotification(inviteId, invite) {
    currentGameInvite = { id: inviteId, data: invite };

    const notif = document.getElementById('gameInviteNotification');
    const usernameEl = notif.querySelector('.game-invite-username');

    if (usernameEl) {
        usernameEl.textContent = `${invite.fromUsername} wants to play!`;
    }

    notif.style.display = 'block';

    // Auto-hide after 30 seconds if not interacted with
    setTimeout(() => {
        if (notif.style.display === 'block' && currentGameInvite && currentGameInvite.id === inviteId) {
            hideGameInviteNotification();
            // Auto-decline if not responded
            database.ref(`gameInvites/${playerData.id}/${inviteId}`).remove();
        }
    }, 30000);
}

function hideGameInviteNotification() {
    const notif = document.getElementById('gameInviteNotification');
    notif.style.display = 'none';
    currentGameInvite = null;
}

async function acceptGameInviteFromNotification() {
    if (!currentGameInvite) return;

    const { id: inviteId, data: invite } = currentGameInvite;

    try {
        // Create the game
        const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const questions = generateQuestions(10);

        await database.ref(`games/${gameId}`).set({
            id: gameId,
            mode: '1v1',
            player1: {
                id: invite.from,
                username: invite.fromUsername,
                color: invite.fromColor,
                score: 0,
                answers: {},
                finished: false
            },
            player2: {
                id: playerData.id,
                username: playerData.username,
                color: playerData.color,
                score: 0,
                answers: {},
                finished: false
            },
            questions: questions,
            startTime: Date.now(),
            timeLimit: 80,
            timeExpired: false
        });

        // Mark invite as accepted and add game ID
        await database.ref(`gameInvites/${playerData.id}/${inviteId}`).update({
            accepted: true,
            gameId: gameId
        });

        hideGameInviteNotification();

        // Start the game for this player
        showNotification('Game Starting!', 'Get ready!', '🎮');
        setTimeout(() => {
            database.ref(`games/${gameId}`).once('value', (gameSnapshot) => {
                const game = gameSnapshot.val();
                if (game) {
                    startGame(gameId, game);
                }
            });
        }, 1000);

        // Clean up invite after a delay
        setTimeout(async () => {
            await database.ref(`gameInvites/${playerData.id}/${inviteId}`).remove();
        }, 5000);
    } catch (error) {
        console.error('Error accepting game invite:', error);
        showNotification('Error', 'Failed to accept game invite', '❌');
    }
}

async function declineGameInviteFromNotification() {
    if (!currentGameInvite) return;

    const { id: inviteId } = currentGameInvite;

    try {
        await database.ref(`gameInvites/${playerData.id}/${inviteId}`).remove();
        hideGameInviteNotification();
        showNotification('Invite Declined', 'You declined the game invite', 'ℹ️');
    } catch (error) {
        console.error('Error declining game invite:', error);
    }
}

// View results manually
function viewResults() {
    if (!resultsReadyToView) {
        alert('Results are not ready yet. Please wait...');
        return;
    }

    // v1.5: Clean up vote listener
    if (voteSkipListener) {
        const gameRef = currentGame.mode === 'squad'
            ? database.ref(`games_squad/${currentGame.gameId}`)
            : currentGame.mode === 'trios'
            ? database.ref(`games_trios/${currentGame.gameId}`)
            : database.ref(`games/${currentGame.gameId}`);

        gameRef.child('skipVotes').off('value', voteSkipListener);
        voteSkipListener = null;
    }

    // Hide vote container
    const voteContainer = document.getElementById('voteSkipContainer');
    if (voteContainer) {
        voteContainer.style.display = 'none';
    }

    // Award points and XP
    if (gameWon) {
        playerData.points += 100;
        playerData.wins = (playerData.wins || 0) + 1; // Track wins for cosmetic unlocks
        awardXP(40); // Winner gets 40 XP
    } else if (gameDraw) {
        awardXP(20); // Draw gets 20 XP
    } else {
        awardXP(10); // Loser still gets 10 XP for participating
    }

    showResults(myGameScore, opponentGameScore, gameWon, gameDraw);

    // Reset flags
    resultsReadyToView = false;
}

// ===== SETTINGS FUNCTIONS =====

// Fix matchmaking (clear all queue entries)
async function fixMatchmaking() {
    if (!database || !playerData.id) {
        alert('⚠️ Not connected to database');
        return;
    }

    if (!confirm('Clear all matchmaking queues and reset? This will remove you from all waiting queues.')) {
        return;
    }

    try {
        console.log('🔧 Fixing matchmaking for player:', playerData.id);

        // Remove from ALL waiting queues
        const queues = [
            'waiting_1v1',
            'waiting_trios',
            'waiting_squad',
            'waiting_chat',
            'waiting_rps1v1',
            'waiting_rps1v2',
            'waiting_rps1v3',
            'waiting_war1v1'
        ];

        const removePromises = queues.map(queue =>
            database.ref(`${queue}/${playerData.id}`).remove()
        );

        await Promise.all(removePromises);

        // Clear all active listeners
        if (searchListener) {
            database.ref('games').off('child_added', searchListener);
            database.ref('games_trios').off('child_added', searchListener);
            database.ref('games_squad').off('child_added', searchListener);
            searchListener = null;
        }

        if (rpsSearchListener) {
            database.ref('games_rps').off('child_added', rpsSearchListener);
            rpsSearchListener = null;
        }

        if (warSearchListener) {
            database.ref('games_war').off('child_added', warSearchListener);
            warSearchListener = null;
        }

        if (chatListener) {
            database.ref('chats').off('child_added', chatListener);
            chatListener = null;
        }

        console.log('✅ Matchmaking fixed! All queues cleared.');
        showNotification('Matchmaking Fixed!', 'All queue entries cleared. You can now search again.', '✅');

        // Return to main menu
        setTimeout(() => {
            window.gameNavigation.goToMenu();
        }, 1000);

    } catch (error) {
        console.error('❌ Error fixing matchmaking:', error);
        alert('Error fixing matchmaking: ' + error.message);
    }
}

// Reset app data (keeps username and account)
function resetAppData() {
    if (!confirm('Reset app data? This will clear your local game data but keep your username and account.')) {
        return;
    }

    // Keep username and ID
    const keepData = {
        username: playerData.username,
        id: playerData.id,
        color: playerData.color,
        points: playerData.points
    };

    // Clear everything else
    localStorage.clear();

    // Restore essential data
    localStorage.setItem('quizpvp_player', JSON.stringify(keepData));

    alert('App data reset! Reloading...');
    window.location.reload();
}

// v1.5 - Fixed clear account (fully works now)
async function clearAccount() {
    if (!confirm('Delete everything and start fresh? This cannot be undone!')) {
        return;
    }

    if (!confirm('Are you absolutely sure? Your username "' + playerData.username + '" and all progress will be lost!')) {
        return;
    }

    console.log('🗑️ Clearing account completely...');

    const uid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : playerData.id;

    // Remove from database
    if (uid && database) {
        try {
            await database.ref('users/' + uid).remove();
            await database.ref('usernames/' + uid).remove();
            await database.ref('online/' + uid).remove();
            await database.ref('accountAiUsage/' + uid).remove();
            await database.ref('aiChatBonus/' + uid).remove();
            await database.ref('waiting_chat/' + uid).remove();
            await database.ref('waiting_1v1/' + uid).remove();
            await database.ref('waiting_trios/' + uid).remove();
            await database.ref('waiting_squad/' + uid).remove();
            console.log('✅ Database entries removed');
        } catch (error) {
            console.error('❌ Error removing from database:', error);
        }
    }

    // Sign out of Firebase Auth
    if (typeof auth !== 'undefined' && auth) {
        try { await auth.signOut(); } catch(e) {}
    }

    // Clear local storage completely
    localStorage.clear();
    sessionStorage.clear();

    // Clear any service workers/cache
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        });
    }

    showNotification('Account Deleted', 'Reloading...', '🗑️');

    setTimeout(() => {
        window.location.reload(true);
    }, 1000);
}

// Event listeners are now set up in setupEventListeners() function, called after DOMContentLoaded

// Initialize - ALL event listeners must be inside DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 QuizPVP v1.6 initializing...');

    // loadingScreen is the initial active screen — prevents any flash of auth UI on refresh

    // Anti-abuse: multiple tab guard
    setupTabDetection();

    // Attach all DOM event listeners (screen is ready)
    setupEventListeners();

    // Fallback: if Firebase takes >4 seconds, show auth screen anyway
    const authFallback = setTimeout(() => {
        if (document.getElementById('loadingScreen')?.classList.contains('active')) {
            showScreen('authScreen');
        }
    }, 4000);

    // Bootstrap auth — onAuthStateChanged is the single entry point for the app
    if (isFirebaseReady && typeof auth !== 'undefined' && auth) {
        auth.onAuthStateChanged(async (user) => {
            clearTimeout(authFallback);
            console.log('🔑 Auth:', user ? (user.isAnonymous ? 'guest' : user.email) : 'signed out');
            await handleAuthStateChange(user);
        });
    } else {
        clearTimeout(authFallback);
        showScreen('authScreen');
    }

    console.log('✅ QuizPVP v1.6 ready!');
});

// ===== ROCK PAPER SCISSORS GAME =====

// RPS Game state
let currentRPSGame = {
    gameId: '',
    mode: 'rps1v1',
    currentRound: 1,
    totalRounds: 5,
    myScore: 0,
    opponentScore: 0,
    rounds: [], // Track all rounds
    myChoice: null,
    opponentChoice: null,
    players: [] // For multi-player modes
};

let rpsGameListener = null;
let rpsSearchListener = null;

// Add navigation function for RPS mode
window.gameNavigation.goToRPSMode = function() {
    console.log('✊ RPS mode selected');
    this.showScreen('rpsModeScreen');
    currentMode = 'rps1v1';
};

// Add navigation function for War mode
window.gameNavigation.goToWarMode = function() {
    console.log('🃏 War mode selected');
    this.showScreen('warModeScreen');
    currentMode = 'war1v1';
};

// Track RPS player counts
function trackRPSModePlayerCounts() {
    if (!database) return;

    database.ref('waiting_rps1v1').on('value', (snapshot) => {
        const count = snapshot.numChildren();
        const el = document.getElementById('countRps1v1');
        if (el) el.textContent = count;
    });

    database.ref('waiting_rps1v2').on('value', (snapshot) => {
        const count = snapshot.numChildren();
        const el = document.getElementById('countRps1v2');
        if (el) el.textContent = count;
    });

    database.ref('waiting_rps1v3').on('value', (snapshot) => {
        const count = snapshot.numChildren();
        const el = document.getElementById('countRps1v3');
        if (el) el.textContent = count;
    });

    console.log('✅ RPS mode player count tracking initialized');
}

// Start RPS matchmaking
async function startRPSMatchmaking() {
    if (!isFirebaseReady || !database) {
        alert('⚠️ Firebase is not connected!');
        console.error('❌ Firebase not ready. Cannot start RPS matchmaking.');
        showScreen('rpsModeScreen');
        return;
    }

    currentSearchType = 'game';
    showScreen('searchingScreen');

    if (currentMode === 'rps1v1') {
        await findRPS1v1Match();
    } else if (currentMode === 'rps1v2') {
        await findRPS1v2Match();
    } else if (currentMode === 'rps1v3') {
        await findRPS1v3Match();
    }
}

// Find RPS 1v1 match - REWRITTEN FROM SCRATCH (matches math game logic exactly)
async function findRPS1v1Match() {
    try {
        // Clean up old waiting entries
        const waitingRef = database.ref('waiting_rps1v1');
        console.log('📡 Checking RPS 1v1 queue...');
        const snapshot = await waitingRef.once('value');
        const waiting = snapshot.val() || {};
        console.log('✅ Connected to database. Waiting RPS 1v1 players:', Object.keys(waiting).length);

        // Remove stale entries (older than 30 seconds)
        const now = Date.now();
        Object.keys(waiting).forEach(key => {
            if (waiting[key] && now - waiting[key].timestamp > 30000) {
                console.log('🗑️ Removing stale RPS player:', key);
                waitingRef.child(key).remove();
            }
        });

        // Check for available opponent
        const freshSnapshot = await waitingRef.once('value');
        const freshWaiting = freshSnapshot.val() || {};
        const availablePlayers = Object.entries(freshWaiting).filter(([id]) => id !== playerData.id);

        console.log('Available RPS opponents:', availablePlayers.length);

        if (availablePlayers.length > 0) {
            // Match found!
            const [opponentId, opponentData] = availablePlayers[0];
            console.log('✅ RPS Match found! Opponent:', opponentData.username);

            // Remove opponent from waiting
            await waitingRef.child(opponentId).remove();

            // Also remove self if in queue
            await waitingRef.child(playerData.id).remove();

            // Create game
            const gameId = 'rps_' + generateId();

            const gameData = {
                id: gameId,
                mode: 'rps1v1',
                player1: {
                    id: playerData.id,
                    username: playerData.username,
                    color: playerData.color,
                    level: playerData.level || 1,
                    score: 0,
                    choices: {}
                },
                player2: {
                    id: opponentId,
                    username: opponentData.username,
                    color: opponentData.color,
                    level: opponentData.level || 1,
                    score: 0,
                    choices: {}
                },
                currentRound: 1,
                totalRounds: 5,
                rounds: {},
                createdAt: Date.now(),
                finished: false
            };

            console.log('🎮 Creating RPS game:', gameId);
            await database.ref(`games_rps/${gameId}`).set(gameData);

            // Show match found notification
            showNotification('Match Found!', 'Starting RPS battle!', '✊');

            // Start game for both players
            setTimeout(() => startRPSGame(gameId, gameData), 1000); // Delay for notification
        } else {
            // Add self to waiting
            console.log('⏳ No RPS opponents found. Joining waiting queue...');
            await waitingRef.child(playerData.id).set({
                username: playerData.username,
                color: playerData.color,
                level: playerData.level || 1,
                timestamp: Date.now()
            });
            console.log('✅ Added to RPS queue. Waiting for opponent...');

            // Clean up old listener if exists
            if (rpsSearchListener) {
                database.ref('games_rps').off('child_added', rpsSearchListener);
            }

            // Listen for game creation
            rpsSearchListener = database.ref('games_rps').on('child_added', (snapshot) => {
                const game = snapshot.val();
                console.log('🎮 New RPS game detected:', game.id);

                if (game && game.mode === 'rps1v1' && game.player2 && game.player2.id === playerData.id) {
                    // Found a game!
                    console.log('✅ RPS Matched! Starting game...');
                    showNotification('Match Found!', 'RPS opponent found!', '✊');

                    if (rpsSearchListener) {
                        database.ref('games_rps').off('child_added', rpsSearchListener);
                        rpsSearchListener = null;
                    }

                    // Remove from waiting
                    database.ref(`waiting_rps1v1/${playerData.id}`).remove();

                    setTimeout(() => startRPSGame(game.id, game), 1000); // Delay for notification
                }
            });
        }
    } catch (error) {
        console.error('❌ RPS 1v1 matchmaking error:', error);
        handleMatchmakingError(error);
    }
}

// Find RPS 1v2 match (3 players) - REWRITTEN FROM SCRATCH (matches trios logic exactly)
async function findRPS1v2Match() {
    try {
        const waitingRef = database.ref('waiting_rps1v2');
        console.log('📡 Checking RPS 1v2 queue...');
        const snapshot = await waitingRef.once('value');
        const waiting = snapshot.val() || {};
        console.log('✅ Connected to database. Waiting RPS 1v2 players:', Object.keys(waiting).length);

        // Clean up stale entries
        const now = Date.now();
        Object.keys(waiting).forEach(key => {
            if (waiting[key] && now - waiting[key].timestamp > 60000) { // 60 sec for RPS 1v2
                console.log('🗑️ Removing stale RPS 1v2 player:', key);
                waitingRef.child(key).remove();
            }
        });

        // Check if we have 3 players
        const freshSnapshot = await waitingRef.once('value');
        const freshWaiting = freshSnapshot.val() || {};
        const availablePlayers = Object.entries(freshWaiting).filter(([id]) => id !== playerData.id);

        console.log('RPS 1v2 queue:', availablePlayers.length + 1, '/ 3 players');

        if (availablePlayers.length >= 2) {
            // We have 3 players! (2 + myself)
            console.log('✅ RPS 1v2 ready! 3 players found!');

            const rpsPlayers = [
                { id: playerData.id, ...playerData },
                ...availablePlayers.slice(0, 2).map(([id, data]) => ({ id, ...data }))
            ];

            // Remove all players from waiting
            for (const player of rpsPlayers) {
                await waitingRef.child(player.id).remove();
            }

            // Create RPS 1v2 game
            const gameId = 'rps_' + generateId();

            const gameData = {
                id: gameId,
                mode: 'rps1v2',
                players: rpsPlayers.map(p => ({
                    id: p.id,
                    username: p.username,
                    color: p.color,
                    level: p.level || 1,
                    score: 0,
                    choices: {}
                })),
                currentRound: 1,
                totalRounds: 5,
                rounds: {},
                createdAt: Date.now(),
                finished: false
            };

            console.log('🎮 Creating RPS 1v2 game:', gameId);
            await database.ref(`games_rps/${gameId}`).set(gameData);

            showNotification('Match Found!', 'RPS 1v2 ready!', '🔺');
            setTimeout(() => startRPSGame(gameId, gameData), 1000);
        } else {
            // Add self to waiting
            console.log(`⏳ Waiting for RPS 1v2... (${availablePlayers.length + 1}/3 players)`);
            await waitingRef.child(playerData.id).set({
                username: playerData.username,
                color: playerData.color,
                level: playerData.level || 1,
                timestamp: Date.now()
            });

            // Update searching text
            document.querySelector('.searching-text').textContent =
                `Waiting for RPS 1v2... (${availablePlayers.length + 1}/3 players)`;

            // Clean up old listener
            if (rpsSearchListener) {
                database.ref('games_rps').off('child_added', rpsSearchListener);
            }

            // Listen for RPS 1v2 game creation
            rpsSearchListener = database.ref('games_rps').on('child_added', (snapshot) => {
                const game = snapshot.val();
                console.log('🎮 New RPS 1v2 game detected:', game.id);

                // Check if I'm in this game
                const imInGame = game.mode === 'rps1v2' && game.players && game.players.some(p => p.id === playerData.id);

                if (imInGame) {
                    console.log('✅ Joined RPS 1v2 game!');
                    showNotification('Match Found!', 'RPS 1v2 match ready!', '🔺');

                    if (rpsSearchListener) {
                        database.ref('games_rps').off('child_added', rpsSearchListener);
                        rpsSearchListener = null;
                    }

                    database.ref(`waiting_rps1v2/${playerData.id}`).remove();
                    setTimeout(() => startRPSGame(game.id, game), 1000); // Delay for notification
                }
            });
        }
    } catch (error) {
        console.error('❌ RPS 1v2 matchmaking error:', error);
        handleMatchmakingError(error);
    }
}

// Find RPS 1v3 match (4 players) - REWRITTEN FROM SCRATCH (matches squad logic exactly)
async function findRPS1v3Match() {
    try {
        const waitingRef = database.ref('waiting_rps1v3');
        console.log('📡 Checking RPS 1v3 queue...');
        const snapshot = await waitingRef.once('value');
        const waiting = snapshot.val() || {};
        console.log('✅ Connected to database. Waiting RPS 1v3 players:', Object.keys(waiting).length);

        // Clean up stale entries
        const now = Date.now();
        Object.keys(waiting).forEach(key => {
            if (waiting[key] && now - waiting[key].timestamp > 60000) { // 60 sec for RPS 1v3
                console.log('🗑️ Removing stale RPS 1v3 player:', key);
                waitingRef.child(key).remove();
            }
        });

        // Check if we have 4 players
        const freshSnapshot = await waitingRef.once('value');
        const freshWaiting = freshSnapshot.val() || {};
        const availablePlayers = Object.entries(freshWaiting).filter(([id]) => id !== playerData.id);

        console.log('RPS 1v3 queue:', availablePlayers.length + 1, '/ 4 players');

        if (availablePlayers.length >= 3) {
            // We have 4 players! (3 + myself)
            console.log('✅ RPS 1v3 ready! 4 players found!');

            const rpsPlayers = [
                { id: playerData.id, ...playerData },
                ...availablePlayers.slice(0, 3).map(([id, data]) => ({ id, ...data }))
            ];

            // Remove all players from waiting
            for (const player of rpsPlayers) {
                await waitingRef.child(player.id).remove();
            }

            // Create RPS 1v3 game
            const gameId = 'rps_' + generateId();

            const gameData = {
                id: gameId,
                mode: 'rps1v3',
                players: rpsPlayers.map(p => ({
                    id: p.id,
                    username: p.username,
                    color: p.color,
                    level: p.level || 1,
                    score: 0,
                    choices: {}
                })),
                currentRound: 1,
                totalRounds: 5,
                rounds: {},
                createdAt: Date.now(),
                finished: false
            };

            console.log('🎮 Creating RPS 1v3 game:', gameId);
            await database.ref(`games_rps/${gameId}`).set(gameData);

            showNotification('Match Found!', 'RPS 1v3 ready!', '👥');
            setTimeout(() => startRPSGame(gameId, gameData), 1000);
        } else {
            // Add self to waiting
            console.log(`⏳ Waiting for RPS 1v3... (${availablePlayers.length + 1}/4 players)`);
            await waitingRef.child(playerData.id).set({
                username: playerData.username,
                color: playerData.color,
                level: playerData.level || 1,
                timestamp: Date.now()
            });

            // Update searching text
            document.querySelector('.searching-text').textContent =
                `Waiting for RPS 1v3... (${availablePlayers.length + 1}/4 players)`;

            // Clean up old listener
            if (rpsSearchListener) {
                database.ref('games_rps').off('child_added', rpsSearchListener);
            }

            // Listen for RPS 1v3 game creation
            rpsSearchListener = database.ref('games_rps').on('child_added', (snapshot) => {
                const game = snapshot.val();
                console.log('🎮 New RPS 1v3 game detected:', game.id);

                // Check if I'm in this game
                const imInGame = game.mode === 'rps1v3' && game.players && game.players.some(p => p.id === playerData.id);

                if (imInGame) {
                    console.log('✅ Joined RPS 1v3 game!');
                    showNotification('Match Found!', 'RPS 1v3 match ready!', '👥');

                    if (rpsSearchListener) {
                        database.ref('games_rps').off('child_added', rpsSearchListener);
                        rpsSearchListener = null;
                    }

                    database.ref(`waiting_rps1v3/${playerData.id}`).remove();
                    setTimeout(() => startRPSGame(game.id, game), 1000); // Delay for notification
                }
            });
        }
    } catch (error) {
        console.error('❌ RPS 1v3 matchmaking error:', error);
        handleMatchmakingError(error);
    }
}

// Start RPS game
function startRPSGame(gameId, gameData) {
    console.log('🎮 Starting RPS game:', gameId);

    currentRPSGame = {
        gameId: gameId,
        mode: gameData.mode,
        currentRound: gameData.currentRound || 1,
        totalRounds: gameData.totalRounds || 5,
        myScore: 0,
        opponentScore: 0,
        rounds: [],
        myChoice: null,
        opponentChoice: null,
        players: gameData.players || []
    };

    // Setup game display
    showScreen('rpsGameScreen');

    if (gameData.mode === 'rps1v1' || gameData.mode === 'rpsbot') {
        // 1v1 mode or bot mode
        const isPlayer1 = gameData.player1.id === playerData.id;
        const me = isPlayer1 ? gameData.player1 : gameData.player2;
        const opponent = isPlayer1 ? gameData.player2 : gameData.player1;

        document.getElementById('rpsYourName').textContent = me.username;
        document.getElementById('rpsOpponentName').textContent = opponent.username;
        applyAvatarStyle(document.getElementById('rpsYourAvatar'), me.color);
        applyAvatarStyle(document.getElementById('rpsOpponentAvatar'), opponent.color);

        currentRPSGame.myScore = me.score || 0;
        currentRPSGame.opponentScore = opponent.score || 0;
    } else {
        // Multi-player mode - show first opponent
        const me = gameData.players.find(p => p.id === playerData.id);
        const opponent = gameData.players.find(p => p.id !== playerData.id);

        document.getElementById('rpsYourName').textContent = me.username;
        document.getElementById('rpsOpponentName').textContent = opponent ? opponent.username : 'Opponents';
        applyAvatarStyle(document.getElementById('rpsYourAvatar'), me.color);
        applyAvatarStyle(document.getElementById('rpsOpponentAvatar'), opponent ? opponent.color : '#999');
    }

    updateRPSScoreDisplay();
    setupRPSRound();

    // Listen for game updates (ONLY for online games, not bot games)
    if (gameData.mode === 'rpsbot' || gameId.startsWith('bot_')) {
        console.log('🤖 Bot game - skipping Firebase listeners');
        // Bot games don't use Firebase
    } else {
        // Online game - set up Firebase listener
        if (rpsGameListener) {
            database.ref(`games_rps/${gameId}`).off('value', rpsGameListener);
        }

        rpsGameListener = database.ref(`games_rps/${gameId}`).on('value', (snapshot) => {
            const game = snapshot.val();
            if (!game) return;

            checkRPSRoundComplete(game);
        });
    }
}

// Setup new RPS round
function setupRPSRound() {
    document.getElementById('rpsCurrentRound').textContent = currentRPSGame.currentRound;
    document.getElementById('rpsRoundStatus').textContent = 'Choose your move!';

    // Reset buttons
    document.querySelectorAll('.rps-btn').forEach(btn => {
        btn.classList.remove('selected', 'disabled');
    });

    // Hide result overlay
    const resultDiv = document.getElementById('rpsRoundResult');
    if (resultDiv) resultDiv.style.display = 'none';

    // Hide waiting
    const waitingDiv = document.getElementById('rpsWaiting');
    if (waitingDiv) waitingDiv.style.display = 'none';

    currentRPSGame.myChoice = null;
    currentRPSGame.opponentChoice = null;
}

// Play RPS move (handles both bot and online games)
async function playRPSMove(choice) {
    if (currentRPSGame.myChoice) return; // Already made a choice

    currentRPSGame.myChoice = choice;

    // Visual feedback
    document.querySelectorAll('.rps-btn').forEach(btn => {
        if (btn.dataset.choice === choice) {
            btn.classList.add('selected');
        } else {
            btn.classList.add('disabled');
        }
    });

    document.getElementById('rpsRoundStatus').textContent = 'Move locked in!';

    // Show waiting
    document.getElementById('rpsWaiting').style.display = 'block';

    // Check if this is a bot game
    if (currentRPSGame.mode === 'rpsbot' || currentRPSGame.gameId.startsWith('bot_')) {
        console.log(`👤 Player chose: ${choice}`);

        // Bot game - make bot choice after a short delay
        setTimeout(() => {
            // Make bot choice INDEPENDENT of player choice
            const botChoice = botMakeChoice();
            currentRPSGame.opponentChoice = botChoice;

            console.log(`🎮 Round ${currentRPSGame.currentRound} - Player: ${currentRPSGame.myChoice} vs Bot: ${botChoice}`);

            // Verify choices are different (at least sometimes)
            if (currentRPSGame.myChoice === botChoice) {
                console.log('🤝 Same choice - will be a draw');
            } else {
                console.log('⚔️ Different choices - someone will win!');
            }

            // Show round result
            showRPSRoundResult(currentRPSGame.myChoice, currentRPSGame.opponentChoice);
        }, 800); // 800ms delay for bot to "think"
        return; // Exit early for bot games
    }

    // Online game - submit choice to Firebase
    const roundKey = `round${currentRPSGame.currentRound}`;

    try {
        if (currentRPSGame.mode === 'rps1v1') {
            const game = await database.ref(`games_rps/${currentRPSGame.gameId}`).once('value');
            const gameData = game.val();
            const isPlayer1 = gameData.player1.id === playerData.id;
            const playerKey = isPlayer1 ? 'player1' : 'player2';

            await database.ref(`games_rps/${currentRPSGame.gameId}/${playerKey}/choices/${roundKey}`).set(choice);
        } else {
            const playerIndex = currentRPSGame.players.findIndex(p => p.id === playerData.id);
            await database.ref(`games_rps/${currentRPSGame.gameId}/players/${playerIndex}/choices/${roundKey}`).set(choice);
        }
    } catch (error) {
        console.error('Error submitting RPS choice:', error);
    }
}

// Bot makes random choice with improved randomization
function botMakeChoice() {
    const choices = ['rock', 'paper', 'scissors'];

    // Use crypto.getRandomValues for better randomness if available
    let randomIndex;
    if (window.crypto && window.crypto.getRandomValues) {
        const randomArray = new Uint32Array(1);
        window.crypto.getRandomValues(randomArray);
        randomIndex = randomArray[0] % 3;
    } else {
        randomIndex = Math.floor(Math.random() * 3);
    }

    const choice = choices[randomIndex];
    console.log(`🤖 Bot randomly selected: ${choice} (index: ${randomIndex})`);
    return choice;
}

// Check if round is complete
function checkRPSRoundComplete(game) {
    const roundKey = `round${currentRPSGame.currentRound}`;

    if (game.mode === 'rps1v1') {
        const p1Choice = game.player1.choices?.[roundKey];
        const p2Choice = game.player2.choices?.[roundKey];

        if (p1Choice && p2Choice && !currentRPSGame.opponentChoice) {
            const isPlayer1 = game.player1.id === playerData.id;
            currentRPSGame.opponentChoice = isPlayer1 ? p2Choice : p1Choice;

            // Show round result
            showRPSRoundResult(currentRPSGame.myChoice, currentRPSGame.opponentChoice);
        }
    } else {
        // Multi-player: check if all players have chosen
        const allChosen = game.players.every(p => p.choices?.[roundKey]);

        if (allChosen && !currentRPSGame.opponentChoice) {
            // For multi-player, we'll just show results against first opponent for now
            const myIndex = game.players.findIndex(p => p.id === playerData.id);
            const opponentIndex = (myIndex + 1) % game.players.length;
            currentRPSGame.opponentChoice = game.players[opponentIndex].choices[roundKey];

            showRPSRoundResult(currentRPSGame.myChoice, currentRPSGame.opponentChoice);
        }
    }

    // Check if game is finished
    if (game.finished) {
        endRPSGame(game);
    }
}

// Determine RPS winner
function determineRPSWinner(choice1, choice2) {
    if (choice1 === choice2) return 'draw';
    if (
        (choice1 === 'rock' && choice2 === 'scissors') ||
        (choice1 === 'paper' && choice2 === 'rock') ||
        (choice1 === 'scissors' && choice2 === 'paper')
    ) {
        return 'win';
    }
    return 'lose';
}

// Get emoji for choice
function getRPSEmoji(choice) {
    const emojis = {
        rock: '✊',
        paper: '✋',
        scissors: '✌️'
    };
    return emojis[choice] || '❓';
}

// Show round result
function showRPSRoundResult(myChoice, opponentChoice) {
    const result = determineRPSWinner(myChoice, opponentChoice);

    console.log(`🎯 Round ${currentRPSGame.currentRound} result: ${result.toUpperCase()}`);

    // Update scores
    if (result === 'win') {
        currentRPSGame.myScore++;
        console.log(`✅ You win! Score: ${currentRPSGame.myScore} - ${currentRPSGame.opponentScore}`);
    } else if (result === 'lose') {
        currentRPSGame.opponentScore++;
        console.log(`❌ You lose! Score: ${currentRPSGame.myScore} - ${currentRPSGame.opponentScore}`);
    } else {
        console.log(`🤝 Draw! Score: ${currentRPSGame.myScore} - ${currentRPSGame.opponentScore}`);
    }

    // Update score display
    updateRPSScoreDisplay();

    // Store round result
    currentRPSGame.rounds.push({
        round: currentRPSGame.currentRound,
        myChoice: myChoice,
        opponentChoice: opponentChoice,
        result: result
    });

    // Show result overlay
    document.getElementById('rpsYourChoice').textContent = getRPSEmoji(myChoice);
    document.getElementById('rpsOpponentChoice').textContent = getRPSEmoji(opponentChoice);

    const resultTextEl = document.getElementById('rpsResultText');
    if (result === 'win') {
        resultTextEl.textContent = 'You Win!';
        resultTextEl.className = 'rps-result-outcome win';
    } else if (result === 'lose') {
        resultTextEl.textContent = 'You Lose!';
        resultTextEl.className = 'rps-result-outcome lose';
    } else {
        resultTextEl.textContent = "It's a Draw!";
        resultTextEl.className = 'rps-result-outcome draw';
    }

    document.getElementById('rpsRoundResult').style.display = 'flex';
    document.getElementById('rpsWaiting').style.display = 'none';

    // Check if game is over
    if (currentRPSGame.currentRound >= currentRPSGame.totalRounds) {
        setTimeout(() => {
            finishRPSGame();
        }, 3000);
    } else {
        // Next round
        setTimeout(() => {
            currentRPSGame.currentRound++;
            setupRPSRound();
        }, 3000);
    }
}

// Update score display
function updateRPSScoreDisplay() {
    document.getElementById('rpsYourScore').textContent = currentRPSGame.myScore;
    document.getElementById('rpsOpponentScore').textContent = currentRPSGame.opponentScore;
}

// Finish RPS game
async function finishRPSGame() {
    // Check if this is a bot game
    const isBotGame = currentRPSGame.mode === 'rpsbot' || currentRPSGame.gameId.startsWith('bot_');

    if (!isBotGame) {
        // Online game - update Firebase
        try {
            await database.ref(`games_rps/${currentRPSGame.gameId}/finished`).set(true);

            // Update final scores
            if (currentRPSGame.mode === 'rps1v1') {
                const game = await database.ref(`games_rps/${currentRPSGame.gameId}`).once('value');
                const gameData = game.val();
                const isPlayer1 = gameData.player1.id === playerData.id;
                const playerKey = isPlayer1 ? 'player1' : 'player2';

                await database.ref(`games_rps/${currentRPSGame.gameId}/${playerKey}/score`).set(currentRPSGame.myScore);
            } else {
                const playerIndex = currentRPSGame.players.findIndex(p => p.id === playerData.id);
                await database.ref(`games_rps/${currentRPSGame.gameId}/players/${playerIndex}/score`).set(currentRPSGame.myScore);
            }
        } catch (error) {
            console.error('Error finishing RPS game:', error);
        }
    } else {
        // Bot game - no Firebase updates needed
        console.log('🤖 Bot game finished - skipping Firebase updates');
    }

    showRPSResults();
}

// End RPS game (from Firebase update)
function endRPSGame(game) {
    if (rpsGameListener) {
        database.ref(`games_rps/${currentRPSGame.gameId}`).off('value', rpsGameListener);
        rpsGameListener = null;
    }

    // Clean up game after 30 seconds
    setTimeout(() => {
        database.ref(`games_rps/${currentRPSGame.gameId}`).remove();
    }, 30000);
}

// Forfeit RPS game - FIXED
function forfeitRPSGame() {
    console.log('🏳️ Forfeit RPS button clicked');

    if (!currentRPSGame || !currentRPSGame.gameId) {
        alert('⚠️ No active game');
        return;
    }

    if (!confirm('Forfeit this match? You will lose!')) {
        return;
    }

    console.log('Forfeiting RPS game:', currentRPSGame.gameId);

    // Clean up listener
    if (rpsGameListener) {
        try {
            database.ref(`games_rps/${currentRPSGame.gameId}`).off('value', rpsGameListener);
        } catch (e) {
            console.log('Error cleaning up listener:', e);
        }
        rpsGameListener = null;
    }

    // Update database if online game
    const isBotGame = currentRPSGame.mode === 'rpsbot' || currentRPSGame.gameId.startsWith('bot_');
    if (!isBotGame && database) {
        try {
            database.ref(`games_rps/${currentRPSGame.gameId}`).update({
                finished: true,
                forfeited: true,
                forfeitedBy: playerData.id
            });
        } catch (e) {
            console.log('Error updating forfeit:', e);
        }
    }

    // Set scores for loss
    currentRPSGame.myScore = 0;
    currentRPSGame.opponentScore = 5;

    // Show results
    showNotification('Forfeited', 'Match forfeited', '🏳️');
    setTimeout(() => showRPSResults(), 300);
}

// Show RPS results
function showRPSResults() {
    showScreen('rpsResultsScreen');

    const won = currentRPSGame.myScore > currentRPSGame.opponentScore;
    const draw = currentRPSGame.myScore === currentRPSGame.opponentScore;

    // Show banner (matching math game style)
    const banner = document.getElementById('rpsResultBanner');
    if (won) {
        banner.textContent = '🎉 VICTORY! 🎉';
        banner.className = 'result-banner victory';
    } else if (draw) {
        banner.textContent = '🤝 DRAW 🤝';
        banner.className = 'result-banner draw';
    } else {
        banner.textContent = '💔 DEFEAT 💔';
        banner.className = 'result-banner defeat';
    }

    // Show final scores
    document.getElementById('rpsFinalYourScore').textContent = currentRPSGame.myScore;
    document.getElementById('rpsFinalOpponentScore').textContent = currentRPSGame.opponentScore;

    // Check if this is a bot game for different rewards
    const isBotGame = currentRPSGame.mode === 'rpsbot' || currentRPSGame.gameId.startsWith('bot_');

    // Award points and XP
    let pointsEarned = 0;
    let xpEarned = 0;

    if (isBotGame) {
        // Bot game rewards - ZERO (practice mode only)
        pointsEarned = 0;  // No points from bot games
        xpEarned = 0;      // No XP from bot games
        console.log('🤖 Bot game rewards: +0 points, +0 XP (practice mode)');
    } else {
        // Online game rewards - full points
        if (won) {
            pointsEarned = 100;
            xpEarned = 50;
            playerData.wins = (playerData.wins || 0) + 1; // Track wins for cosmetic unlocks
        } else if (draw) {
            pointsEarned = 50;
            xpEarned = 25;
        } else {
            pointsEarned = 20;
            xpEarned = 20;
        }
        console.log('🎮 Online game rewards: +' + pointsEarned + ' points, +' + xpEarned + ' XP');
    }

    playerData.points += pointsEarned;
    awardXP(xpEarned);

    // Show points earned (matching math game style)
    document.getElementById('rpsPointsEarned').innerHTML = `
        <strong>+${pointsEarned} Points</strong> | +${xpEarned} XP
    `;

    // Show rounds review (matching answers review style)
    const reviewDiv = document.getElementById('rpsRoundsReview');
    reviewDiv.innerHTML = '<h3>Round History</h3>';

    currentRPSGame.rounds.forEach((round, index) => {
        const resultClass = round.result === 'win' ? 'correct' : round.result === 'lose' ? 'incorrect' : 'draw';
        const resultIcon = round.result === 'win' ? '✓' : round.result === 'lose' ? '✗' : '−';
        const resultText = round.result === 'win' ? 'WIN' : round.result === 'lose' ? 'LOSS' : 'DRAW';

        reviewDiv.innerHTML += `
            <div class="answer-item ${resultClass}">
                <span class="question-num">Round ${round.round}</span>
                <span class="user-answer">${getRPSEmoji(round.myChoice)} vs ${getRPSEmoji(round.opponentChoice)}</span>
                <span class="result-icon">${resultIcon}</span>
            </div>
        `;
    });
}

// ===== RPS BOT GAME =====

// Start RPS bot game
function startRPSBotGame() {
    console.log('🤖 Starting RPS bot game...');

    const gameId = 'bot_' + generateId();
    const gameData = {
        id: gameId,
        mode: 'rpsbot',
        isBot: true,
        player1: {
            id: playerData.id,
            username: playerData.username,
            color: playerData.color,
            level: playerData.level || 1,
            score: 0,
            choices: {}
        },
        player2: {
            id: 'bot',
            username: '🤖 Bot',
            color: '#999',
            level: 1,
            score: 0,
            choices: {}
        },
        currentRound: 1,
        totalRounds: 5,
        rounds: {},
        createdAt: Date.now(),
        finished: false
    };

    startRPSGame(gameId, gameData);
}

// ============================================================================
// WAR CARD GAME
// ============================================================================

// War Game state
let currentWarGame = {
    gameId: '',
    mode: 'war1v1',
    currentRound: 1,
    totalRounds: 7,
    myScore: 0,
    opponentScore: 0,
    rounds: [],
    myCard: null,
    opponentCard: null,
    deck: [],
    opponentDeck: [],
    isWarRound: false // Flag for when cards tie
};

let warGameListener = null;
let warSearchListener = null;

// Card generation utilities
const CARD_SUITS = ['♠️', '♥️', '♦️', '♣️'];
const CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const CARD_RANKS = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

function generateDeck() {
    const deck = [];
    for (const suit of CARD_SUITS) {
        for (const value of CARD_VALUES) {
            deck.push({ suit, value, rank: CARD_RANKS[value] });
        }
    }
    return shuffleDeck(deck);
}

function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function getCardDisplay(card) {
    if (!card) return '?';
    return `${card.value}${card.suit}`;
}

function getCardColor(card) {
    if (!card) return '#333';
    return (card.suit === '♥️' || card.suit === '♦️') ? '#e74c3c' : '#2c3e50';
}

// Track War player counts
function trackWarModePlayerCounts() {
    if (!database) return;

    database.ref('waiting_war1v1').on('value', (snapshot) => {
        const count = snapshot.numChildren();
        const el = document.getElementById('countWar1v1');
        if (el) el.textContent = count;
    });

    console.log('✅ War mode player count tracking initialized');
}

// War Mode Selection Handlers
function selectWarMode(mode) {
    currentMode = mode;
    console.log('🃏 War mode selected:', mode);

    // Update button states
    const modes = ['warMode1v1Btn', 'warModeVsBotBtn'];
    modes.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) btn.classList.remove('active');
    });

    const modeMap = {
        'war1v1': 'warMode1v1Btn',
        'warbot': 'warModeVsBotBtn'
    };

    const activeBtn = document.getElementById(modeMap[mode]);
    if (activeBtn) activeBtn.classList.add('active');

    // Update button visibility
    const findMatchBtn = document.getElementById('findWarMatchBtn');
    const startBotBtn = document.getElementById('startWarBotBtn');

    if (mode === 'warbot') {
        if (findMatchBtn) findMatchBtn.style.display = 'none';
        if (startBotBtn) {
            startBotBtn.style.display = 'block';
            startBotBtn.textContent = 'Play VS Bot';
        }
    } else {
        if (findMatchBtn) {
            findMatchBtn.style.display = 'block';
            findMatchBtn.textContent = 'Find Match (1v1)';
        }
        if (startBotBtn) startBotBtn.style.display = 'none';
    }
}

// Start War matchmaking
async function startWarMatchmaking() {
    if (!isFirebaseReady || !database) {
        alert('⚠️ Firebase is not connected!');
        console.error('❌ Firebase not ready. Cannot start War matchmaking.');
        showScreen('warModeScreen');
        return;
    }

    currentSearchType = 'game';
    showScreen('searchingScreen');

    if (currentMode === 'war1v1') {
        await findWar1v1Match();
    }
}

// Find War 1v1 match - FIXED with better error handling
async function findWar1v1Match() {
    console.log('🃏 findWar1v1Match called');
    console.log('Current mode:', currentMode);
    console.log('Player ID:', playerData.id);
    console.log('Firebase ready:', isFirebaseReady);

    try {
        const waitingRef = database.ref('waiting_war1v1');
        console.log('📡 Checking War 1v1 queue...');

        const snapshot = await waitingRef.once('value');
        const waiting = snapshot.val() || {};
        console.log('✅ Connected. Waiting War players:', Object.keys(waiting).length, waiting);

        // Remove stale entries (older than 30 seconds)
        const now = Date.now();
        const staleKeys = Object.keys(waiting).filter(key =>
            waiting[key] && now - waiting[key].timestamp > 30000
        );

        if (staleKeys.length > 0) {
            console.log('🗑️ Removing', staleKeys.length, 'stale War players');
            for (const key of staleKeys) {
                await waitingRef.child(key).remove();
            }
        }

        // Check for available opponent
        const freshSnapshot = await waitingRef.once('value');
        const freshWaiting = freshSnapshot.val() || {};
        const availablePlayers = Object.entries(freshWaiting).filter(([id]) => id !== playerData.id);

        console.log('Available War opponents:', availablePlayers.length);

        if (availablePlayers.length > 0) {
            // Match found!
            const [opponentId, opponentData] = availablePlayers[0];
            console.log('✅ War match found! Opponent:', opponentData.username);

            // Remove both from waiting
            await waitingRef.child(opponentId).remove();
            await waitingRef.child(playerData.id).remove();
            console.log('Removed both players from queue');

            // Create game
            const gameId = 'war_' + generateId();
            const deck1 = generateDeck();
            const deck2 = generateDeck();

            const gameData = {
                id: gameId,
                mode: 'war1v1',
                player1: {
                    id: playerData.id,
                    username: playerData.username,
                    color: playerData.color,
                    level: playerData.level || 1,
                    score: 0,
                    cards: {},
                    deck: deck1
                },
                player2: {
                    id: opponentId,
                    username: opponentData.username,
                    color: opponentData.color,
                    level: opponentData.level || 1,
                    score: 0,
                    cards: {},
                    deck: deck2
                },
                currentRound: 1,
                totalRounds: 7,
                rounds: {},
                createdAt: Date.now(),
                finished: false
            };

            console.log('🎮 Creating War game:', gameId);
            console.log('Game data:', gameData);

            await database.ref(`games_war/${gameId}`).set(gameData);
            console.log('✅ War game created successfully in database');

            showNotification('Match Found!', 'Starting War battle!', '🃏');

            // Start game for player1 (creator)
            console.log('Starting game for player 1...');
            setTimeout(() => startWarGame(gameId, gameData), 1000);
        } else {
            // Add self to waiting
            console.log('⏳ No War opponents found. Joining waiting queue...');
            await waitingRef.child(playerData.id).set({
                username: playerData.username,
                color: playerData.color,
                level: playerData.level || 1,
                timestamp: Date.now()
            });
            console.log('✅ Added to War queue. Waiting for opponent...');

            // Clean up old listener if exists
            if (warSearchListener) {
                console.log('Cleaning up old War listener');
                database.ref('games_war').off('child_added', warSearchListener);
                warSearchListener = null;
            }

            // Listen for game creation (BOTH players use this!)
            console.log('Setting up War game listener for player 2...');
            warSearchListener = database.ref('games_war').on('child_added', (snapshot) => {
                const game = snapshot.val();
                console.log('🎮 New War game detected:', game ? game.id : 'null game');
                console.log('Game data:', game);

                if (!game) {
                    console.log('⚠️ Game data is null');
                    return;
                }

                console.log('Checking if this is my game...');
                console.log('Game mode:', game.mode);
                console.log('Player2 exists:', !!game.player2);
                console.log('Player2 ID:', game.player2 ? game.player2.id : 'null');
                console.log('My ID:', playerData.id);
                console.log('Match:', game.player2 && game.player2.id === playerData.id);

                // Check if I'm player2 in this game
                if (game && game.mode === 'war1v1' && game.player2 && game.player2.id === playerData.id) {
                    // Found my game!
                    console.log('✅✅✅ War matched! This is MY game! Starting...');
                    showNotification('Match Found!', 'War opponent found!', '🃏');

                    if (warSearchListener) {
                        console.log('Cleaning up War listener after match');
                        database.ref('games_war').off('child_added', warSearchListener);
                        warSearchListener = null;
                    }

                    // Remove from waiting
                    console.log('Removing player 2 from waiting queue');
                    database.ref(`waiting_war1v1/${playerData.id}`).remove();

                    console.log('Starting game for player 2...');
                    setTimeout(() => startWarGame(game.id, game), 1000);
                } else {
                    console.log('Not my game, skipping...');
                }
            });

            console.log('✅ War listener set up successfully');
        }
    } catch (error) {
        console.error('❌ War matchmaking error:', error);
        console.error('Error stack:', error.stack);
        handleMatchmakingError(error);
    }
}

// Start War game
function startWarGame(gameId, gameData) {
    console.log('🃏 Starting War game:', gameId);

    currentWarGame.gameId = gameId;
    currentWarGame.mode = gameData.mode;
    currentWarGame.currentRound = gameData.currentRound || 1;
    currentWarGame.totalRounds = gameData.totalRounds || 7;
    currentWarGame.rounds = [];
    currentWarGame.isWarRound = false;

    const iAmPlayer1 = gameData.player1.id === playerData.id;
    const opponent = iAmPlayer1 ? gameData.player2 : gameData.player1;
    const me = iAmPlayer1 ? gameData.player1 : gameData.player2;

    currentWarGame.myScore = me.score || 0;
    currentWarGame.opponentScore = opponent.score || 0;
    currentWarGame.deck = me.deck || [];
    currentWarGame.opponentDeck = opponent.deck || [];

    showScreen('warGameScreen');

    // Update UI
    document.getElementById('warOpponentName').textContent = opponent.username;
    document.getElementById('warOpponentLabel').textContent = opponent.username;
    updateWarUI();

    const isBotGame = gameId.startsWith('bot_');

    if (!isBotGame) {
        // Listen to game updates
        const gameRef = database.ref(`games_war/${gameId}`);
        warGameListener = gameRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            if (data.finished) {
                finishWarGame(data);
                return;
            }

            const iAmP1 = data.player1.id === playerData.id;
            const me = iAmP1 ? data.player1 : data.player2;
            const opp = iAmP1 ? data.player2 : data.player1;

            currentWarGame.myScore = me.score || 0;
            currentWarGame.opponentScore = opp.score || 0;
            currentWarGame.currentRound = data.currentRound || 1;

            updateWarUI();

            // Check if opponent played
            const currentRound = data.currentRound;
            const myCard = me.cards ? me.cards[currentRound] : null;
            const oppCard = opp.cards ? opp.cards[currentRound] : null;

            if (myCard && oppCard) {
                // Both played - show result
                displayWarRoundResult(myCard, oppCard);
            } else if (myCard && !oppCard) {
                // Waiting for opponent
                document.getElementById('warWaitingMsg').style.display = 'block';
                document.getElementById('warFlipBtn').style.display = 'none';
            }
        });
    }

    // Setup leave button
    const leaveBtn = document.getElementById('warLeaveBtn');
    if (leaveBtn) {
        leaveBtn.onclick = () => {
            if (confirm('Are you sure you want to leave this game?')) {
                leaveWarGame();
            }
        };
    }

    // Setup flip button
    const flipBtn = document.getElementById('warFlipBtn');
    if (flipBtn) {
        flipBtn.onclick = () => playWarCard();
    }

    // Setup next round button
    const nextBtn = document.getElementById('warNextRoundBtn');
    if (nextBtn) {
        nextBtn.onclick = () => nextWarRound();
    }
}

// Update War UI
function updateWarUI() {
    document.getElementById('warCurrentRound').textContent = currentWarGame.currentRound;
    document.getElementById('warYourScore').textContent = currentWarGame.myScore;
    document.getElementById('warOpponentScore').textContent = currentWarGame.opponentScore;

    // Reset cards
    const playerCard = document.getElementById('warPlayerCard');
    const opponentCard = document.getElementById('warOpponentCard');

    playerCard.className = 'war-card card-back';
    playerCard.innerHTML = '<div class="card-content">?</div>';

    opponentCard.className = 'war-card card-back';
    opponentCard.innerHTML = '<div class="card-content">?</div>';

    // Hide messages
    document.getElementById('warWaitingMsg').style.display = 'none';
    document.getElementById('warRoundResult').style.display = 'none';
    document.getElementById('warAnnouncement').style.display = 'none';
    document.getElementById('warNextRoundBtn').style.display = 'none';

    // Show flip button
    document.getElementById('warFlipBtn').style.display = 'block';
}

// Play a card
async function playWarCard() {
    const roundNum = currentWarGame.currentRound;

    // Draw card from deck
    const myCard = currentWarGame.deck[roundNum - 1];
    if (!myCard) {
        console.error('❌ No card available');
        return;
    }

    currentWarGame.myCard = myCard;

    // Display my card
    const playerCardEl = document.getElementById('warPlayerCard');
    playerCardEl.className = 'war-card card-revealed';
    playerCardEl.innerHTML = `<div class="card-content" style="color: ${getCardColor(myCard)}">${getCardDisplay(myCard)}</div>`;
    playerCardEl.classList.add('flip-animation');

    document.getElementById('warFlipBtn').style.display = 'none';

    const isBotGame = currentWarGame.gameId.startsWith('bot_');

    if (isBotGame) {
        // Bot plays immediately
        setTimeout(() => {
            botPlayWarCard();
        }, 800);
    } else {
        // Save to Firebase
        const gameRef = database.ref(`games_war/${currentWarGame.gameId}`);
        const iAmPlayer1 = (await gameRef.child('player1/id').once('value')).val() === playerData.id;
        const playerPath = iAmPlayer1 ? 'player1' : 'player2';

        await gameRef.child(`${playerPath}/cards/${roundNum}`).set(myCard);

        // Check if opponent already played
        const opponentPath = iAmPlayer1 ? 'player2' : 'player1';
        const oppCardSnap = await gameRef.child(`${opponentPath}/cards/${roundNum}`).once('value');

        if (oppCardSnap.exists()) {
            const oppCard = oppCardSnap.val();
            displayWarRoundResult(myCard, oppCard);
        } else {
            document.getElementById('warWaitingMsg').style.display = 'block';
        }
    }
}

// Bot plays card
function botPlayWarCard() {
    const roundNum = currentWarGame.currentRound;
    const botCard = currentWarGame.opponentDeck[roundNum - 1];

    currentWarGame.opponentCard = botCard;

    // Display bot card
    const opponentCardEl = document.getElementById('warOpponentCard');
    opponentCardEl.className = 'war-card card-revealed';
    opponentCardEl.innerHTML = `<div class="card-content" style="color: ${getCardColor(botCard)}">${getCardDisplay(botCard)}</div>`;
    opponentCardEl.classList.add('flip-animation');

    setTimeout(() => {
        displayWarRoundResult(currentWarGame.myCard, botCard);
    }, 500);
}

// Display round result
function displayWarRoundResult(myCard, oppCard) {
    document.getElementById('warWaitingMsg').style.display = 'none';

    // Show opponent's card if not already shown
    const opponentCardEl = document.getElementById('warOpponentCard');
    if (opponentCardEl.classList.contains('card-back')) {
        opponentCardEl.className = 'war-card card-revealed';
        opponentCardEl.innerHTML = `<div class="card-content" style="color: ${getCardColor(oppCard)}">${getCardDisplay(oppCard)}</div>`;
        opponentCardEl.classList.add('flip-animation');
    }

    const myRank = myCard.rank;
    const oppRank = oppCard.rank;

    let resultText = '';
    let roundPoints = 1;

    if (myRank > oppRank) {
        resultText = '🎉 You Win This Round! 🎉';
        currentWarGame.myScore += roundPoints;
    } else if (oppRank > myRank) {
        resultText = '😞 Opponent Wins This Round';
        currentWarGame.opponentScore += roundPoints;
    } else {
        // WAR!
        resultText = '⚔️ WAR! Equal Cards! ⚔️';
        document.getElementById('warAnnouncement').style.display = 'block';
        roundPoints = 2; // War rounds worth more!

        // Determine war winner (higher card rank from original comparison, or random if truly equal)
        const warWinner = Math.random() > 0.5;
        if (warWinner) {
            currentWarGame.myScore += roundPoints;
            resultText += '<br>You Win The War! 🏆';
        } else {
            currentWarGame.opponentScore += roundPoints;
            resultText += '<br>Opponent Wins The War!';
        }
    }

    // Save round
    currentWarGame.rounds.push({
        round: currentWarGame.currentRound,
        myCard: myCard,
        opponentCard: oppCard,
        winner: myRank > oppRank ? 'me' : (oppRank > myRank ? 'opponent' : 'war')
    });

    // Display result
    const resultEl = document.getElementById('warRoundResult');
    resultEl.innerHTML = resultText;
    resultEl.style.display = 'block';

    // Update scores
    updateWarScores();

    // Check if game is over
    if (currentWarGame.currentRound >= currentWarGame.totalRounds) {
        setTimeout(() => {
            endWarGame();
        }, 2000);
    } else {
        document.getElementById('warNextRoundBtn').style.display = 'block';
    }
}

// Update scores
function updateWarScores() {
    document.getElementById('warYourScore').textContent = currentWarGame.myScore;
    document.getElementById('warOpponentScore').textContent = currentWarGame.opponentScore;

    const isBotGame = currentWarGame.gameId.startsWith('bot_');

    if (!isBotGame && database) {
        const gameRef = database.ref(`games_war/${currentWarGame.gameId}`);
        gameRef.child('player1/id').once('value').then((snapshot) => {
            const iAmPlayer1 = snapshot.val() === playerData.id;
            const playerPath = iAmPlayer1 ? 'player1' : 'player2';
            const opponentPath = iAmPlayer1 ? 'player2' : 'player1';

            gameRef.child(`${playerPath}/score`).set(currentWarGame.myScore);
            gameRef.child(`${opponentPath}/score`).set(currentWarGame.opponentScore);
        });
    }
}

// Next round
function nextWarRound() {
    currentWarGame.currentRound++;

    const isBotGame = currentWarGame.gameId.startsWith('bot_');

    if (!isBotGame && database) {
        database.ref(`games_war/${currentWarGame.gameId}/currentRound`).set(currentWarGame.currentRound);
    }

    updateWarUI();
}

// End War game
async function endWarGame() {
    const isBotGame = currentWarGame.gameId.startsWith('bot_');

    if (!isBotGame && database) {
        await database.ref(`games_war/${currentWarGame.gameId}/finished`).set(true);
    } else {
        // Bot game - finish locally
        finishWarGame({
            player1: {
                id: playerData.id,
                username: playerData.username,
                score: currentWarGame.myScore
            },
            player2: {
                id: 'bot',
                username: '🤖 Bot',
                score: currentWarGame.opponentScore
            },
            finished: true,
            mode: 'warbot'
        });
    }
}

// Finish War game
function finishWarGame(gameData) {
    console.log('🏁 War game finished');

    if (warGameListener && database) {
        database.ref(`games_war/${currentWarGame.gameId}`).off('value', warGameListener);
        warGameListener = null;
    }

    const iAmPlayer1 = gameData.player1.id === playerData.id;
    const me = iAmPlayer1 ? gameData.player1 : gameData.player2;
    const opponent = iAmPlayer1 ? gameData.player2 : gameData.player1;

    const myScore = me.score || currentWarGame.myScore;
    const opponentScore = opponent.score || currentWarGame.opponentScore;
    const won = myScore > opponentScore;
    const draw = myScore === opponentScore;

    // Calculate rewards
    const isBotGame = currentWarGame.gameId.startsWith('bot_');
    let pointsEarned = 0;
    let xpEarned = 0;

    if (isBotGame) {
        // Bot games give ZERO rewards (practice mode)
        pointsEarned = 0;
        xpEarned = 0;
        console.log('🤖 Bot game rewards: +0 points, +0 XP (practice mode)');
    } else {
        // Online game rewards
        if (won) {
            pointsEarned = 10;
            xpEarned = 20;
            playerData.wins = (playerData.wins || 0) + 1; // Track wins for cosmetic unlocks
        } else if (draw) {
            pointsEarned = 3;
            xpEarned = 5;
        } else {
            pointsEarned = 1;
            xpEarned = 2;
        }

        // Update player data
        playerData.points = (playerData.points || 0) + pointsEarned;
        playerData.xp = (playerData.xp || 0) + xpEarned;

        if (database) {
            database.ref(`players/${playerData.id}`).update({
                points: playerData.points,
                xp: playerData.xp
            });
        }

        updatePlayerUI();
    }

    showWarResults(won, draw, myScore, opponentScore, opponent.username, pointsEarned, xpEarned);
}

// Forfeit War game - FIXED
function forfeitWarGame() {
    console.log('🏳️ Forfeit War button clicked');

    if (!currentWarGame || !currentWarGame.gameId) {
        alert('⚠️ No active game');
        return;
    }

    if (!confirm('Forfeit this match? You will lose!')) {
        return;
    }

    console.log('Forfeiting War game:', currentWarGame.gameId);

    // Clean up listener
    if (warGameListener) {
        try {
            database.ref(`games_war/${currentWarGame.gameId}`).off('value', warGameListener);
        } catch (e) {
            console.log('Error cleaning up listener:', e);
        }
        warGameListener = null;
    }

    // Update database if online game
    const isBotGame = currentWarGame.gameId.startsWith('bot_');
    if (!isBotGame && database) {
        try {
            database.ref(`games_war/${currentWarGame.gameId}`).update({
                finished: true,
                forfeited: true,
                forfeitedBy: playerData.id
            });
        } catch (e) {
            console.log('Error updating forfeit:', e);
        }
    }

    // Set scores for loss
    currentWarGame.myScore = 0;
    currentWarGame.opponentScore = 7;

    // Show results
    showNotification('Forfeited', 'Match forfeited', '🏳️');
    setTimeout(() => showWarResults(false, false, 0, 7, 'Opponent', 0, 0), 300);
}

// Show War results
function showWarResults(won, draw, myScore, opponentScore, opponentName, pointsEarned, xpEarned) {
    showScreen('warResultsScreen');

    const banner = document.getElementById('warResultBanner');
    if (won) {
        banner.textContent = '🎉 VICTORY! 🎉';
        banner.className = 'result-banner victory';
    } else if (draw) {
        banner.textContent = '🤝 DRAW! 🤝';
        banner.className = 'result-banner draw';
    } else {
        banner.textContent = '😞 DEFEAT 😞';
        banner.className = 'result-banner defeat';
    }

    document.getElementById('warFinalYourScore').textContent = myScore;
    document.getElementById('warFinalOpponentScore').textContent = opponentScore;

    document.getElementById('warPointsEarned').innerHTML = `
        <strong>+${pointsEarned} Points</strong> | +${xpEarned} XP
    `;

    // Show rounds review
    const reviewDiv = document.getElementById('warRoundsReview');
    reviewDiv.innerHTML = '<h3>Round History</h3>';

    currentWarGame.rounds.forEach(round => {
        const resultClass = round.winner === 'me' ? 'correct' : (round.winner === 'opponent' ? 'wrong' : 'war');
        const resultIcon = round.winner === 'me' ? '✓' : (round.winner === 'opponent' ? '✗' : '⚔️');

        reviewDiv.innerHTML += `
            <div class="answer-item ${resultClass}">
                <span class="question-num">Round ${round.round}</span>
                <span class="user-answer">${getCardDisplay(round.myCard)} vs ${getCardDisplay(round.opponentCard)}</span>
                <span class="result-icon">${resultIcon}</span>
            </div>
        `;
    });
}

// Leave War game
function leaveWarGame() {
    if (warGameListener && database) {
        database.ref(`games_war/${currentWarGame.gameId}`).off('value', warGameListener);
        warGameListener = null;
    }

    if (warSearchListener && database) {
        database.ref('waiting_war1v1').off('child_added', warSearchListener);
        warSearchListener = null;
    }

    showScreen('warModeScreen');
}

// Start War bot game
function startWarBotGame() {
    console.log('🤖 Starting War bot game...');

    const gameId = 'bot_' + generateId();
    const deck1 = generateDeck();
    const deck2 = generateDeck();

    const gameData = {
        id: gameId,
        mode: 'warbot',
        isBot: true,
        player1: {
            id: playerData.id,
            username: playerData.username,
            color: playerData.color,
            level: playerData.level || 1,
            score: 0,
            cards: {},
            deck: deck1
        },
        player2: {
            id: 'bot',
            username: '🤖 Bot',
            color: '#999',
            level: 1,
            score: 0,
            cards: {},
            deck: deck2
        },
        currentRound: 1,
        totalRounds: 7,
        rounds: {},
        createdAt: Date.now(),
        finished: false
    };

    startWarGame(gameId, gameData);
}

// Setup all event listeners - called after DOM is ready
function setupEventListeners() {
    console.log('🎯 Setting up event listeners...');

    // Helper function to safely add event listener
    function safeAddListener(elementId, event, handler, description) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(event, handler);
            console.log(`✓ ${description || elementId}`);
            return true;
        } else {
            console.warn(`⚠️ Element not found: ${elementId}`);
            return false;
        }
    }

    // === HUB NAVIGATION (CRITICAL) ===
    console.log('🏠 Setting up Hub Navigation...');
    safeAddListener('playBtn', 'click', () => {
        console.log('🎮 Play button clicked');
        showScreen('playScreen');
    }, 'Play button');

    safeAddListener('socialBtn', 'click', () => {
        console.log('💬 Social button clicked');
        showScreen('socialScreen');
        loadFriendsList();
        loadFriendRequests();
        initAIChat();
    }, 'Social button');

    safeAddListener('settingsHubBtn', 'click', () => {
        console.log('⚙️ Settings button clicked');
        showScreen('settingsScreen');
    }, 'Settings Hub button');

    // === NAVIGATION BACK BUTTONS ===
    console.log('⬅️ Setting up Back buttons...');
    safeAddListener('backToMenuFromPlay', 'click', () => {
        showScreen('menuScreen');
    }, 'Back to Menu from Play');

    safeAddListener('backToPlayFromMath', 'click', () => {
        showScreen('playScreen');
    }, 'Back to Play from Math');

    safeAddListener('backToMenuFromSocial', 'click', () => {
        showScreen('menuScreen');
    }, 'Back to Menu from Social');

    safeAddListener('closeSettingsBtn', 'click', () => {
        showScreen('menuScreen');
    }, 'Close Settings');

    // === GAME TYPE SELECTION ===
    console.log('🎮 Setting up Game Type buttons...');
    safeAddListener('mathGameBtn', 'click', () => {
        console.log('➕ Math game selected');
        showScreen('mathModeScreen');
    }, 'Math Game button');

    safeAddListener('rpsGameBtn', 'click', () => {
        alert('Rock Paper Scissors coming soon!');
    }, 'RPS Game button');

    // === MATH MODE SELECTION ===
    console.log('🔢 Setting up Math Mode buttons...');
    safeAddListener('mode1v1Btn', 'click', () => {
        currentMode = '1v1';
        document.getElementById('mode1v1Btn').classList.add('active');
        document.getElementById('mode1v2Btn')?.classList.remove('active');
        document.getElementById('mode1v3Btn')?.classList.remove('active');
        document.getElementById('modeWhoAmIBtn')?.classList.remove('active');
        document.getElementById('findMatchBtn').textContent = 'Find Match (1v1)';
        console.log('🎯 Mode switched to: 1v1');
    }, '1v1 Mode');

    safeAddListener('mode1v2Btn', 'click', () => {
        currentMode = '1v2';
        document.getElementById('mode1v2Btn').classList.add('active');
        document.getElementById('mode1v1Btn')?.classList.remove('active');
        document.getElementById('mode1v3Btn')?.classList.remove('active');
        document.getElementById('modeWhoAmIBtn')?.classList.remove('active');
        document.getElementById('findMatchBtn').textContent = 'Find Match (1v2)';
        console.log('🎯 Mode switched to: 1v2');
    }, '1v2 Mode');

    safeAddListener('mode1v3Btn', 'click', () => {
        currentMode = '1v3';
        document.getElementById('mode1v3Btn').classList.add('active');
        document.getElementById('mode1v1Btn')?.classList.remove('active');
        document.getElementById('mode1v2Btn')?.classList.remove('active');
        document.getElementById('modeWhoAmIBtn')?.classList.remove('active');
        document.getElementById('findMatchBtn').textContent = 'Find Match (1v3)';
        console.log('🎯 Mode switched to: 1v3');
    }, '1v3 Mode');

    safeAddListener('modeWhoAmIBtn', 'click', () => {
        currentMode = 'whoami';
        document.getElementById('modeWhoAmIBtn').classList.add('active');
        document.getElementById('mode1v1Btn')?.classList.remove('active');
        document.getElementById('mode1v2Btn')?.classList.remove('active');
        document.getElementById('mode1v3Btn')?.classList.remove('active');
        document.getElementById('findMatchBtn').textContent = 'Start Who Am I (Mobile)';
        console.log('🎯 Mode switched to: Who Am I');
    }, 'Who Am I Mode');

    // === SOCIAL TABS ===
    console.log('💬 Setting up Social tabs...');
    safeAddListener('chatTabBtn', 'click', () => {
        document.getElementById('chatTabBtn')?.classList.add('active');
        document.getElementById('friendsTabBtn')?.classList.remove('active');
        const chatTab = document.getElementById('chatTabContent');
        const friendsTab = document.getElementById('friendsTabContent');
        if (chatTab) chatTab.style.display = 'block';
        if (friendsTab) friendsTab.style.display = 'none';
    }, 'Chat Tab');

    safeAddListener('friendsTabBtn', 'click', () => {
        document.getElementById('friendsTabBtn')?.classList.add('active');
        document.getElementById('chatTabBtn')?.classList.remove('active');
        const friendsTab = document.getElementById('friendsTabContent');
        const chatTab = document.getElementById('chatTabContent');
        if (friendsTab) friendsTab.style.display = 'block';
        if (chatTab) chatTab.style.display = 'none';
        loadFriendsList();
        loadFriendRequests();
    }, 'Friends Tab');

    safeAddListener('startChatBtn', 'click', () => {
        findChatPartner();
    }, 'Start Chat button');

    // === AUTH BUTTONS ===
    console.log('🔐 Setting up Auth buttons...');

    // Auth landing screen
    safeAddListener('authShowRegisterBtn', 'click', () => showScreen('registerScreen'), 'Show Register');
    safeAddListener('authShowLoginBtn',    'click', () => showScreen('loginScreen'),    'Show Login');
    safeAddListener('authGuestBtn',        'click', () => signInAsGuest(),              'Guest mode');

    // Login screen
    safeAddListener('loginSubmitBtn', 'click', () => {
        const email    = document.getElementById('loginEmailInput')?.value.trim();
        const password = document.getElementById('loginPasswordInput')?.value;
        loginWithEmail(email, password);
    }, 'Login submit');
    safeAddListener('loginBackBtn',          'click', () => showScreen('authScreen'),    'Login back');
    safeAddListener('switchToRegisterLink',  'click', () => showScreen('registerScreen'),'Switch to register');

    const loginEmailInput = document.getElementById('loginEmailInput');
    const loginPasswordInput = document.getElementById('loginPasswordInput');
    if (loginEmailInput) loginEmailInput.addEventListener('keypress', e => { if (e.key === 'Enter') loginPasswordInput?.focus(); });
    if (loginPasswordInput) loginPasswordInput.addEventListener('keypress', e => { if (e.key === 'Enter') document.getElementById('loginSubmitBtn')?.click(); });

    // Register screen
    safeAddListener('registerSubmitBtn', 'click', () => {
        const username = document.getElementById('registerUsernameInput')?.value.trim();
        const email    = document.getElementById('registerEmailInput')?.value.trim();
        const password = document.getElementById('registerPasswordInput')?.value;
        registerWithEmail(username, email, password);
    }, 'Register submit');
    safeAddListener('registerBackBtn',   'click', () => showScreen('authScreen'),   'Register back');
    safeAddListener('switchToLoginLink', 'click', () => showScreen('loginScreen'),  'Switch to login');

    const registerPasswordInput = document.getElementById('registerPasswordInput');
    if (registerPasswordInput) registerPasswordInput.addEventListener('keypress', e => { if (e.key === 'Enter') document.getElementById('registerSubmitBtn')?.click(); });

    // Email verify screen
    safeAddListener('verifyCheckBtn',  'click', () => checkEmailVerification(),    'Verify check');
    safeAddListener('resendVerifyBtn', 'click', () => resendVerificationEmail(),   'Resend verify');
    safeAddListener('verifySignOutBtn','click', () => signOutUser(),               'Verify sign out');


    // === GAME BUTTONS ===
    console.log('🎲 Setting up Game buttons...');
    safeAddListener('findMatchBtn', 'click', () => {
        findMatch();
    }, 'Find Match');

    safeAddListener('cancelSearchBtn', 'click', () => {
        cancelSearch();
    }, 'Cancel Search');

    safeAddListener('nextBtn', 'click', () => {
        nextQuestion();
    }, 'Next Question');

    const answerInput = document.getElementById('answerInput');
    if (answerInput) {
        answerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                nextQuestion();
            }
        });
        console.log('✓ Answer input Enter key');
    }

    safeAddListener('playAgainBtn', 'click', () => {
        findMatch();
    }, 'Play Again');

    safeAddListener('backToMenuBtn', 'click', () => {
        showScreen('menuScreen');
    }, 'Back to Menu from Results');

    safeAddListener('viewResultsBtn', 'click', () => {
        viewResults();
    }, 'View Results');

    // v1.5: Vote to skip timer button
    safeAddListener('voteSkipBtn', 'click', () => {
        voteToSkipTimer();
    }, 'Vote to Skip Timer');

    // v1.5: Friend request notification buttons
    safeAddListener('acceptFriendNotifBtn', 'click', () => {
        acceptFriendRequestFromNotification();
    }, 'Accept Friend Request Notification');

    safeAddListener('rejectFriendNotifBtn', 'click', () => {
        rejectFriendRequestFromNotification();
    }, 'Reject Friend Request Notification');

    // v1.5: Game invite notification buttons
    safeAddListener('acceptGameInviteBtn', 'click', () => {
        acceptGameInviteFromNotification();
    }, 'Accept Game Invite');

    safeAddListener('declineGameInviteBtn', 'click', () => {
        declineGameInviteFromNotification();
    }, 'Decline Game Invite');

    // === SHOP & SETTINGS ===
    console.log('🛒 Setting up Shop buttons...');
    safeAddListener('shopBtn', 'click', () => {
        showScreen('shopScreen');
    }, 'Shop button');

    const colorPicker = document.getElementById('colorPicker');
    if (colorPicker) {
        colorPicker.addEventListener('input', updateColorPreview);
        console.log('✓ Color Picker');
    }

    // === CHAT BUTTONS ===
    console.log('💬 Setting up Chat buttons...');
    safeAddListener('sendMessageBtn', 'click', () => {
        sendChatMessage();
    }, 'Send Message');

    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
        console.log('✓ Chat input Enter key');
    }

    safeAddListener('skipChatBtn', 'click', () => {
        skipChatPartner(); // v1.5: No confirm needed
    }, 'Skip Chat Partner');

    safeAddListener('leaveChatBtn', 'click', () => {
        leaveChat(); // v1.5: No confirm needed
    }, 'Leave Chat');

    safeAddListener('addFriendBtn', 'click', () => {
        sendFriendRequest();
    }, 'Add Friend');

    // === FRIEND SYSTEM ===
    console.log('👥 Setting up Friend system...');
    safeAddListener('friendsListTab', 'click', () => {
        document.getElementById('friendsListTab')?.classList.add('active');
        document.getElementById('friendRequestsTab')?.classList.remove('active');
        document.getElementById('aiChatTab')?.classList.remove('active');
        const listContent = document.getElementById('friendsListContent');
        const requestsContent = document.getElementById('friendRequestsContent');
        const aiContent = document.getElementById('aiChatContent');
        if (listContent) listContent.style.display = 'block';
        if (requestsContent) requestsContent.style.display = 'none';
        if (aiContent) aiContent.style.display = 'none';
    }, 'Friends List Tab');

    safeAddListener('friendRequestsTab', 'click', () => {
        document.getElementById('friendRequestsTab')?.classList.add('active');
        document.getElementById('friendsListTab')?.classList.remove('active');
        document.getElementById('aiChatTab')?.classList.remove('active');
        const requestsContent = document.getElementById('friendRequestsContent');
        const listContent = document.getElementById('friendsListContent');
        const aiContent = document.getElementById('aiChatContent');
        if (requestsContent) requestsContent.style.display = 'block';
        if (listContent) listContent.style.display = 'none';
        if (aiContent) aiContent.style.display = 'none';
    }, 'Friend Requests Tab');

    safeAddListener('aiChatTab', 'click', () => {
        document.getElementById('aiChatTab')?.classList.add('active');
        document.getElementById('friendsListTab')?.classList.remove('active');
        document.getElementById('friendRequestsTab')?.classList.remove('active');
        const aiContent = document.getElementById('aiChatContent');
        const listContent = document.getElementById('friendsListContent');
        const requestsContent = document.getElementById('friendRequestsContent');
        if (aiContent) aiContent.style.display = 'block';
        if (listContent) listContent.style.display = 'none';
        if (requestsContent) requestsContent.style.display = 'none';
        initAIChat();
    }, 'AI Chat Tab');

    safeAddListener('sendFriendMessageBtn', 'click', () => {
        sendFriendMessage();
    }, 'Send Friend Message');

    const friendChatInput = document.getElementById('friendChatInput');
    if (friendChatInput) {
        friendChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendFriendMessage();
            }
        });
        console.log('✓ Friend chat input Enter key');
    }

    safeAddListener('leaveFriendChatBtn', 'click', () => {
        showScreen('socialScreen');
        document.getElementById('friendsTabBtn')?.classList.add('active');
        document.getElementById('chatTabBtn')?.classList.remove('active');
        const friendsTab = document.getElementById('friendsTabContent');
        const chatTab = document.getElementById('chatTabContent');
        if (friendsTab) friendsTab.style.display = 'block';
        if (chatTab) chatTab.style.display = 'none';
    }, 'Leave Friend Chat');

    safeAddListener('inviteFriendToGameBtn', 'click', () => {
        if (currentChatSession.partnerId) {
            inviteFriendTo1v1(currentChatSession.partnerId, currentChatSession.partnerUsername);
        }
    }, 'Invite Friend to Game');

    // === REFRESH BUTTON ===
    console.log('🔄 Setting up Refresh button...');
    safeAddListener('refreshBtn', 'click', () => {
        console.log('🔄 Refreshing app...');
        const btn = document.getElementById('refreshBtn');
        if (btn) btn.style.transform = 'rotate(360deg)';

        setTimeout(() => {
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                });
            }
            window.location.reload(true);
        }, 300);
    }, 'Refresh button');

    // === ROCK PAPER SCISSORS BUTTONS ===
    console.log('✊ Setting up Rock Paper Scissors buttons...');

    // RPS Mode selection buttons
    safeAddListener('rpsMode1v1Btn', 'click', () => {
        currentMode = 'rps1v1';
        document.querySelectorAll('#rpsModeScreen .mode-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('rpsMode1v1Btn')?.classList.add('active');
        const findBtn = document.getElementById('findRPSMatchBtn');
        const botBtn = document.getElementById('startRPSBotBtn');
        if (findBtn) {
            findBtn.textContent = 'Find Match (1v1)';
            findBtn.style.display = 'block';
        }
        if (botBtn) botBtn.style.display = 'none';
    }, 'RPS 1v1 Mode');

    safeAddListener('rpsMode1v2Btn', 'click', () => {
        currentMode = 'rps1v2';
        document.querySelectorAll('#rpsModeScreen .mode-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('rpsMode1v2Btn')?.classList.add('active');
        const findBtn = document.getElementById('findRPSMatchBtn');
        const botBtn = document.getElementById('startRPSBotBtn');
        if (findBtn) {
            findBtn.textContent = 'Find Match (1v2)';
            findBtn.style.display = 'block';
        }
        if (botBtn) botBtn.style.display = 'none';
    }, 'RPS 1v2 Mode');

    safeAddListener('rpsMode1v3Btn', 'click', () => {
        currentMode = 'rps1v3';
        document.querySelectorAll('#rpsModeScreen .mode-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('rpsMode1v3Btn')?.classList.add('active');
        const findBtn = document.getElementById('findRPSMatchBtn');
        const botBtn = document.getElementById('startRPSBotBtn');
        if (findBtn) {
            findBtn.textContent = 'Find Match (1v3)';
            findBtn.style.display = 'block';
        }
        if (botBtn) botBtn.style.display = 'none';
    }, 'RPS 1v3 Mode');

    safeAddListener('rpsModeVsBotBtn', 'click', () => {
        currentMode = 'rpsbot';
        document.querySelectorAll('#rpsModeScreen .mode-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('rpsModeVsBotBtn')?.classList.add('active');
        const findBtn = document.getElementById('findRPSMatchBtn');
        const botBtn = document.getElementById('startRPSBotBtn');
        if (findBtn) findBtn.style.display = 'none';
        if (botBtn) botBtn.style.display = 'block';
    }, 'RPS VS Bot Mode');

    safeAddListener('findRPSMatchBtn', 'click', () => {
        startRPSMatchmaking();
    }, 'Find RPS Match');

    safeAddListener('startRPSBotBtn', 'click', () => {
        startRPSBotGame();
    }, 'Start RPS Bot Game');

    // RPS game buttons
    safeAddListener('rpsRockBtn', 'click', () => {
        playRPSMove('rock');
    }, 'RPS Rock');

    safeAddListener('rpsPaperBtn', 'click', () => {
        playRPSMove('paper');
    }, 'RPS Paper');

    safeAddListener('rpsScissorsBtn', 'click', () => {
        playRPSMove('scissors');
    }, 'RPS Scissors');

    // RPS results buttons
    safeAddListener('rpsPlayAgainBtn', 'click', () => {
        showScreen('rpsModeScreen');
    }, 'RPS Play Again');

    safeAddListener('rpsBackToMenuBtn', 'click', () => {
        showScreen('menuScreen');
    }, 'RPS Back to Menu');

    // === WAR CARD GAME ===
    console.log('🃏 Setting up War card game buttons...');

    // War mode selection buttons
    safeAddListener('warMode1v1Btn', 'click', () => {
        selectWarMode('war1v1');
    }, 'War 1v1 Mode');

    safeAddListener('warModeVsBotBtn', 'click', () => {
        selectWarMode('warbot');
    }, 'War VS Bot Mode');

    safeAddListener('findWarMatchBtn', 'click', () => {
        startWarMatchmaking();
    }, 'Find War Match');

    safeAddListener('startWarBotBtn', 'click', () => {
        startWarBotGame();
    }, 'Start War Bot Game');

    // War results buttons
    safeAddListener('warPlayAgainBtn', 'click', () => {
        showScreen('warModeScreen');
    }, 'War Play Again');

    safeAddListener('warBackToMenuBtn', 'click', () => {
        showScreen('menuScreen');
    }, 'War Back to Menu');

    console.log('✅ All event listeners attached successfully!');
}
