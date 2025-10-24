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
let connectedRef;
let myConnectionRef;
let isFirebaseReady = false;

try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
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

// ===== V3.0 FEATURES =====

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

// V3.0 - Track player count per mode
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

console.log('✅ V3.0 features initialized');

// V3.0: Level system - Calculate XP required for next level
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
    xp: 0
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

// V3.0 - Track search type for proper cancel navigation
let currentSearchType = 'game'; // 'game' or 'chat'

// ===== PLAYER PRESENCE & ACTIVE COUNT SYSTEM =====

// Setup player presence tracking
function setupPlayerPresence() {
    if (!database || !playerData.id) return;

    // Reference to online players
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

// Load player data from localStorage
async function loadPlayerData() {
    const saved = localStorage.getItem('quizpvp_player');
    if (saved) {
        const data = JSON.parse(saved);
        playerData.points = data.points || 0;
        playerData.color = data.color || '#4A90E2';
        playerData.id = data.id || generateId();
        playerData.username = data.username || ''; // Load saved username
        playerData.friends = data.friends || [];
        playerData.friendRequests = data.friendRequests || [];
        playerData.level = data.level || 1;
        playerData.xp = data.xp || 0;

        // If username exists, skip to menu and setup
        if (playerData.username && playerData.username.length >= 2) {
            console.log('✅ Loaded saved username:', playerData.username);
            updatePlayerDisplay();
            showScreen('menuScreen');
            setupPlayerPresence();
            trackActivePlayerCount();
            trackModePlayerCounts(); // V3.0
            loadFriendsList();
            loadFriendRequests();
            cleanupOldGames();
            setInterval(cleanupOldGames, 60000);
            return true; // Username loaded
        }
    } else {
        playerData.id = generateId();
    }
    return false; // No username
}

// Save player data to localStorage
function savePlayerData() {
    localStorage.setItem('quizpvp_player', JSON.stringify({
        points: playerData.points,
        color: playerData.color,
        id: playerData.id,
        username: playerData.username, // Save username too
        friends: playerData.friends || [],
        friendRequests: playerData.friendRequests || [],
        level: playerData.level || 1,
        xp: playerData.xp || 0
    }));
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

            // V3.0: Show match found notification
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
                    showNotification('Match Found!', `Opponent found! Starting 1v1...`, '⚔️'); // V3.0

                    if (searchListener) {
                        database.ref('games').off('child_added', searchListener);
                        searchListener = null;
                    }

                    // Remove from waiting
                    database.ref(`waiting_1v1/${playerData.id}`).remove();

                    setTimeout(() => startGame(game.id, game), 1000); // V3.0: Delay for notification
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
                    showNotification('Match Found!', `Trios match ready! Starting 1v2...`, '🔺'); // V3.0

                    if (searchListener) {
                        database.ref('games_trios').off('child_added', searchListener);
                        searchListener = null;
                    }

                    database.ref(`waiting_trios/${playerData.id}`).remove();
                    setTimeout(() => startTriosGame(game.id, game), 1000); // V3.0: Delay for notification
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
                    showNotification('Match Found!', `Squad ready! Starting 1v3...`, '👥'); // V3.0

                    if (searchListener) {
                        database.ref('games_squad').off('child_added', searchListener);
                        searchListener = null;
                    }

                    database.ref(`waiting_squad/${playerData.id}`).remove();
                    setTimeout(() => startSquadGame(game.id, game), 1000); // V3.0: Delay for notification
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
    antiCheatActive = true; // V3.0: Enable anti-tab-switch detection
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

// V3.0: Vote to Skip Timer System
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

    // V3.0: ALWAYS show vote to skip timer - no matter when you finish
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
    playerData.username = newUsername;
    savePlayerData();
    updatePlayerDisplay();
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

    // V3.0: Support direct hex color purchases
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

// V3.0 - Cancel search (smart navigation based on search type)
function cancelSearch() {
    console.log('🚫 Search cancelled by user');

    // Remove from waiting queue (all modes)
    if (database && playerData.id) {
        database.ref(`waiting_1v1/${playerData.id}`).remove();
        database.ref(`waiting_trios/${playerData.id}`).remove();
        database.ref(`waiting_squad/${playerData.id}`).remove();
        database.ref(`waiting_chat/${playerData.id}`).remove();
    }

    // Remove game listeners
    if (searchListener) {
        database.ref('games').off('child_added', searchListener);
        database.ref('games_trios').off('child_added', searchListener);
        database.ref('games_squad').off('child_added', searchListener);
        searchListener = null;
    }

    // Remove chat listeners
    if (chatSearchListener) {
        database.ref('chats').off('child_added', chatSearchListener);
        chatSearchListener = null;
    }

    // Reset searching text
    document.querySelector('.searching-animation h2').textContent = 'Finding Opponent...';
    document.querySelector('.searching-text').textContent = 'Matching you with another player';

    // V3.0: Smart navigation based on what was being searched for
    if (currentSearchType === 'chat') {
        console.log('📱 Returning to Social (Chat tab)');
        showScreen('socialScreen');
        // Make sure chat tab is active
        document.getElementById('chatTabBtn')?.classList.add('active');
        document.getElementById('friendsTabBtn')?.classList.remove('active');
        const chatTab = document.getElementById('chatTabContent');
        const friendsTab = document.getElementById('friendsTabContent');
        if (chatTab) chatTab.style.display = 'block';
        if (friendsTab) friendsTab.style.display = 'none';
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

// V3.0 - Destroy current chat completely
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

// V3.0 - Completely rebuilt chat system
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

// V3.0 - Fixed startChatSession (prevents duplication)
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

    // V3.0 FIX: Track displayed message IDs to prevent duplication
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

// V3.0 - Fixed skip (destroys chat and finds new partner)
async function skipChatPartner() {
    console.log('⏭️ Skipping to next partner...');
    showNotification('Skipping', 'Finding you a new partner...', '⏭️');

    // Destroy current chat completely
    await destroyCurrentChat();

    // Find new partner (will go to loading if no one is waiting)
    await findChatPartner();
}

// V3.0 - Fixed leave (destroys chat and returns to menu)
async function leaveChat() {
    console.log('👋 Leaving chat...');

    // Destroy current chat completely
    await destroyCurrentChat();

    // Always return to menu
    showScreen('menuScreen');
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

// V3.0: Invite friend to 1v1 game
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

// V3.0: Listen for incoming friend requests (real-time)
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

    // V3.0: Clean up vote listener
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

// V3.0 - Fixed clear account (fully works now)
async function clearAccount() {
    if (!confirm('Delete everything and start fresh? This cannot be undone!')) {
        return;
    }

    if (!confirm('Are you absolutely sure? Your username "' + playerData.username + '" and all progress will be lost!')) {
        return;
    }

    console.log('🗑️ Clearing account completely...');

    // Remove from database
    if (playerData.id && database) {
        try {
            await database.ref(`users/${playerData.id}`).remove();
            await database.ref(`usernames/${playerData.username}`).remove();
            await database.ref(`online/${playerData.id}`).remove();
            await database.ref(`waiting_chat/${playerData.id}`).remove();
            await database.ref(`waiting_1v1/${playerData.id}`).remove();
            await database.ref(`waiting_trios/${playerData.id}`).remove();
            await database.ref(`waiting_squad/${playerData.id}`).remove();
            console.log('✅ Database entries removed');
        } catch (error) {
            console.error('❌ Error removing from database:', error);
        }
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
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 QuizPVP initializing...');

    // Load player data first
    await loadPlayerData();

    // V3.0: Setup real-time listeners
    setupGameInviteListener();
    setupFriendRequestListener();

    // Now attach all event listeners (DOM is ready)
    setupEventListeners();

    console.log('✅ QuizPVP ready!');
});

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

    // === USERNAME & JOIN ===
    console.log('👤 Setting up Username buttons...');
    safeAddListener('joinBtn', 'click', async () => {
        const username = document.getElementById('usernameInput')?.value.trim();

        if (!username || username.length < 2) {
            alert('Please enter a username (at least 2 characters)');
            return;
        }

        const taken = await isUsernameTaken(username);
        if (taken) {
            alert('This username is already taken. Please choose a different one.');
            return;
        }

        playerData.username = username;
        await registerUsername(username, playerData.id);
        savePlayerData();
        updatePlayerDisplay();
        showScreen('menuScreen');
        setupPlayerPresence();
        trackActivePlayerCount();
        trackModePlayerCounts(); // V3.0
        loadFriendsList();
        loadFriendRequests();
        cleanupOldGames();
        setInterval(cleanupOldGames, 60000);

        console.log('✅ Player registered:', username);
        console.log('💾 Username saved to localStorage');
    }, 'Join button');

    const usernameInput = document.getElementById('usernameInput');
    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('joinBtn')?.click();
            }
        });
        console.log('✓ Username input Enter key');
    }

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

    // V3.0: Vote to skip timer button
    safeAddListener('voteSkipBtn', 'click', () => {
        voteToSkipTimer();
    }, 'Vote to Skip Timer');

    // V3.0: Friend request notification buttons
    safeAddListener('acceptFriendNotifBtn', 'click', () => {
        acceptFriendRequestFromNotification();
    }, 'Accept Friend Request Notification');

    safeAddListener('rejectFriendNotifBtn', 'click', () => {
        rejectFriendRequestFromNotification();
    }, 'Reject Friend Request Notification');

    // V3.0: Game invite notification buttons
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

    safeAddListener('closeShopBtn', 'click', () => {
        showScreen('settingsScreen');
    }, 'Close Shop');

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
        skipChatPartner(); // V3.0: No confirm needed
    }, 'Skip Chat Partner');

    safeAddListener('leaveChatBtn', 'click', () => {
        leaveChat(); // V3.0: No confirm needed
    }, 'Leave Chat');

    safeAddListener('addFriendBtn', 'click', () => {
        sendFriendRequest();
    }, 'Add Friend');

    // === FRIEND SYSTEM ===
    console.log('👥 Setting up Friend system...');
    safeAddListener('friendsListTab', 'click', () => {
        document.getElementById('friendsListTab')?.classList.add('active');
        document.getElementById('friendRequestsTab')?.classList.remove('active');
        const listContent = document.getElementById('friendsListContent');
        const requestsContent = document.getElementById('friendRequestsContent');
        if (listContent) listContent.style.display = 'block';
        if (requestsContent) requestsContent.style.display = 'none';
    }, 'Friends List Tab');

    safeAddListener('friendRequestsTab', 'click', () => {
        document.getElementById('friendRequestsTab')?.classList.add('active');
        document.getElementById('friendsListTab')?.classList.remove('active');
        const requestsContent = document.getElementById('friendRequestsContent');
        const listContent = document.getElementById('friendsListContent');
        if (requestsContent) requestsContent.style.display = 'block';
        if (listContent) listContent.style.display = 'none';
    }, 'Friend Requests Tab');

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
        showScreen('friendsScreen');
    }, 'Leave Friend Chat');

    safeAddListener('inviteFriendToGameBtn', 'click', () => {
        inviteFriendToGame();
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

    console.log('✅ All event listeners attached successfully!');
}
