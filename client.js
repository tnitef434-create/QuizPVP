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

let playerData = {
    username: '',
    points: 0,
    color: '#4A90E2',
    id: '',
    friends: [],
    friendRequests: []
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
    partnerColor: ''
};
let chatListener = null;
let chatSearchListener = null;

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
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
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

        // If username exists, skip to menu and setup
        if (playerData.username && playerData.username.length >= 2) {
            console.log('✅ Loaded saved username:', playerData.username);
            updatePlayerDisplay();
            showScreen('menuScreen');
            setupPlayerPresence();
            trackActivePlayerCount();
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
        friendRequests: playerData.friendRequests || []
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
    if (currentMode === 'squad') {
        await findSquadMatch();
    } else if (currentMode === 'trios') {
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
                    score: 0,
                    answers: [],
                    finished: false
                },
                player2: {
                    id: opponentId,
                    username: opponentData.username,
                    color: opponentData.color,
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

            // Start game for both players
            startGame(gameId, gameData);
        } else {
            // Add self to waiting
            console.log('⏳ No opponents found. Joining waiting queue...');
            await waitingRef.child(playerData.id).set({
                username: playerData.username,
                color: playerData.color,
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
                    if (searchListener) {
                        database.ref('games').off('child_added', searchListener);
                        searchListener = null;
                    }

                    // Remove from waiting
                    database.ref(`waiting_1v1/${playerData.id}`).remove();

                    startGame(game.id, game);
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
                    if (searchListener) {
                        database.ref('games_trios').off('child_added', searchListener);
                        searchListener = null;
                    }

                    database.ref(`waiting_trios/${playerData.id}`).remove();
                    startTriosGame(game.id, game);
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
                    if (searchListener) {
                        database.ref('games_squad').off('child_added', searchListener);
                        searchListener = null;
                    }

                    database.ref(`waiting_squad/${playerData.id}`).remove();
                    startSquadGame(game.id, game);
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

    // Setup player displays
    document.getElementById('yourName').textContent = playerData.username;
    document.getElementById('opponentName').textContent = opponent.username;

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

// Start Trios Game (3 players)
function startTriosGame(gameId, gameData) {
    currentGame.gameId = gameId;
    currentGame.questions = gameData.questions;
    currentGame.answers = [];
    currentGame.currentQuestionIndex = 0;
    currentGame.mode = 'trios';
    currentGame.players = gameData.players;
    currentGame.gameStartedAt = gameData.gameStartedAt || Date.now();

    showScreen('gameScreen');

    // Show trios display
    const myPlayerIndex = gameData.players.findIndex(p => p.id === playerData.id);
    const otherPlayer = gameData.players.find(p => p.id !== playerData.id);

    document.getElementById('yourName').textContent = `${playerData.username} (Trios)`;
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

    // Listen for trios game updates (including timeExpired flag)
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

// Start Squad Game (4 players)
function startSquadGame(gameId, gameData) {
    currentGame.gameId = gameId;
    currentGame.questions = gameData.questions;
    currentGame.answers = [];
    currentGame.currentQuestionIndex = 0;
    currentGame.mode = 'squad';
    currentGame.players = gameData.players;
    currentGame.gameStartedAt = gameData.gameStartedAt || Date.now();

    showScreen('gameScreen');

    // For now, show simplified squad display (use 1v1 UI)
    const myPlayerIndex = gameData.players.findIndex(p => p.id === playerData.id);
    const otherPlayer = gameData.players.find(p => p.id !== playerData.id);

    document.getElementById('yourName').textContent = `${playerData.username} (Squad)`;
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

    // Listen for squad game updates (including timeExpired flag)
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

        if (timeRemaining <= 0) {
            clearInterval(gameTimer);
            handleTimeUp();
        }
    }, 1000);
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
    // Stop the timer
    stopGameTimer();

    // Calculate score
    let score = 0;
    currentGame.answers.forEach((answer, index) => {
        if (parseInt(answer) === currentGame.questions[index].answer) {
            score++;
        }
    });

    if (currentGame.mode === 'squad') {
        // Squad mode: update player in players array
        const myIndex = currentGame.players.findIndex(p => p.id === playerData.id);

        await database.ref(`games_squad/${currentGame.gameId}/players/${myIndex}`).update({
            score: score,
            answers: currentGame.answers,
            finished: true
        });
    } else if (currentGame.mode === 'trios') {
        // Trios mode: update player in players array
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

    // Show waiting screen
    showScreen('searchingScreen');
    document.querySelector('.searching-animation h2').textContent = 'Calculating Results...';
    const waitText = currentGame.mode === 'squad' ? 'Waiting for all 4 players to finish' :
                     currentGame.mode === 'trios' ? 'Waiting for all 3 players to finish' :
                     'Waiting for opponent to finish';
    document.querySelector('.searching-text').textContent = waitText;
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

        // Results are ready! Show them now
        console.log('📊 Showing results...');

        if (gameListener) {
            database.ref(`games/${currentGame.gameId}`).off('value', gameListener);
            gameListener = null;
        }

        const isPlayer1 = game.player1.id === playerData.id;
        const myScore = isPlayer1 ? game.player1.score : game.player2.score;
        const opponentScore = isPlayer1 ? game.player2.score : game.player1.score;

        const won = myScore > opponentScore;
        const draw = myScore === opponentScore;

        if (won) {
            playerData.points += 100;
            savePlayerData();
        }

        showResults(myScore, opponentScore, won, draw);

        // Clean up game after 30 seconds
        setTimeout(() => {
            database.ref(`games/${currentGame.gameId}`).remove();
        }, 30000);
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

        // Winner gets 100 points
        if (myRank === 1) {
            playerData.points += 100;
            savePlayerData();
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

        // Winner gets 100 points
        if (myRank === 1) {
            playerData.points += 100;
            savePlayerData();
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

function purchaseColor(colorType) {
    let cost = 0;
    let colorValue = '';

    if (colorType === 'gold') {
        cost = 10000;
        colorValue = 'gold';
    } else if (colorType === 'rainbow') {
        cost = 50000;
        colorValue = 'rainbow';
    }

    if (playerData.points < cost) {
        alert(`Not enough points! You need ${cost.toLocaleString()} points.`);
        return;
    }

    if (confirm(`Purchase ${colorType} color for ${colorType.toLocaleString()} points?`)) {
        playerData.points -= cost;
        playerData.color = colorValue;
        savePlayerData();
        updatePlayerDisplay();
        alert(`${colorType} color purchased successfully!`);
    }
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// Cancel search
function cancelSearch() {
    console.log('🚫 Search cancelled by user');

    // Remove from waiting queue (all modes)
    if (database && playerData.id) {
        database.ref(`waiting_1v1/${playerData.id}`).remove();
        database.ref(`waiting_trios/${playerData.id}`).remove();
        database.ref(`waiting_squad/${playerData.id}`).remove();
    }

    // Remove game listeners
    if (searchListener) {
        database.ref('games').off('child_added', searchListener);
        database.ref('games_trios').off('child_added', searchListener);
        database.ref('games_squad').off('child_added', searchListener);
        searchListener = null;
    }

    // Reset searching text
    document.querySelector('.searching-animation h2').textContent = 'Finding Opponent...';
    document.querySelector('.searching-text').textContent = 'Matching you with another player';

    showScreen('menuScreen');
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

// Find chat partner
async function findChatPartner() {
    try {
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

            // Remove partner from waiting
            await waitingRef.child(partnerId).remove();
            await waitingRef.child(playerData.id).remove();

            // Create chat session
            const chatId = generateId();
            const chatData = {
                id: chatId,
                user1: {
                    id: playerData.id,
                    username: playerData.username,
                    color: playerData.color
                },
                user2: {
                    id: partnerId,
                    username: partnerData.username,
                    color: partnerData.color
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

// Start chat session
function startChatSession(chatId, chatData) {
    currentChatSession.chatId = chatId;

    const isUser1 = chatData.user1.id === playerData.id;
    const partner = isUser1 ? chatData.user2 : chatData.user1;

    currentChatSession.partnerId = partner.id;
    currentChatSession.partnerUsername = partner.username;
    currentChatSession.partnerColor = partner.color;

    showScreen('chatScreen');

    // Update partner display
    document.getElementById('chatPartnerName').textContent = partner.username;
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

    // Focus on input
    document.getElementById('chatInput').value = '';
    document.getElementById('chatInput').focus();

    // Listen for new messages
    chatListener = database.ref(`chats/${chatId}/messages`).on('child_added', (snapshot) => {
        const message = snapshot.val();
        if (message) {
            displayChatMessage(message);
        }
    });

    // Listen for partner leaving
    database.ref(`chats/${chatId}/active`).on('value', (snapshot) => {
        if (snapshot.val() === false) {
            handlePartnerLeft();
        }
    });
}

// Display chat message
function displayChatMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');

    const isMe = message.senderId === playerData.id;
    messageDiv.className = `chat-message ${isMe ? 'mine' : 'theirs'}`;

    messageDiv.innerHTML = `
        <div class="message-sender">${isMe ? 'You' : currentChatSession.partnerUsername}</div>
        <div class="message-text">${escapeHtml(message.text)}</div>
        <div class="message-time">${formatTime(message.timestamp)}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send chat message
async function sendChatMessage() {
    const input = document.getElementById('chatInput');
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

// Skip to next chat partner
async function skipChatPartner() {
    if (confirm('Skip to next chat partner?')) {
        await leaveChat(true);
        findChatPartner();
    }
}

// Leave chat
async function leaveChat(skipping = false) {
    // Clean up listeners
    if (chatListener) {
        database.ref(`chats/${currentChatSession.chatId}/messages`).off('child_added', chatListener);
        chatListener = null;
    }

    // Mark chat as inactive
    try {
        await database.ref(`chats/${currentChatSession.chatId}/active`).set(false);
    } catch (error) {
        console.warn('⚠️ Could not mark chat inactive:', error);
    }

    // Reset session
    currentChatSession = {
        chatId: '',
        partnerId: '',
        partnerUsername: '',
        partnerColor: ''
    };

    if (!skipping) {
        showScreen('menuScreen');
    }
}

// Handle partner left
function handlePartnerLeft() {
    alert('Your chat partner has left the conversation.');
    leaveChat();
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
    document.getElementById('friendsCount').textContent = friendsArray.length;

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
                    <button class="btn btn-primary btn-small" onclick="openFriendChat('${friend.id}')">Chat</button>
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

// Invite friend to game
function inviteFriendToGame() {
    alert('Game invitations coming soon! For now, coordinate a time to both click "Find Match" at the same time.');
}

// Event listeners
document.getElementById('joinBtn').addEventListener('click', async () => {
    const username = document.getElementById('usernameInput').value.trim();

    if (username.length < 2) {
        alert('Please enter a username (at least 2 characters)');
        return;
    }

    // Check if username is taken
    const taken = await isUsernameTaken(username);
    if (taken) {
        alert('This username is already taken. Please choose a different one.');
        return;
    }

    playerData.username = username;

    // Register username in database
    await registerUsername(username, playerData.id);

    savePlayerData(); // Save username persistently
    updatePlayerDisplay();
    showScreen('menuScreen');

    // Setup player presence and tracking
    setupPlayerPresence();
    trackActivePlayerCount();
    loadFriendsList();
    loadFriendRequests();

    // Clean up old games periodically
    cleanupOldGames();
    setInterval(cleanupOldGames, 60000); // Every minute

    console.log('✅ Player registered:', username);
    console.log('💾 Username saved to localStorage');
});

document.getElementById('usernameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('joinBtn').click();
    }
});

document.getElementById('findMatchBtn').addEventListener('click', () => {
    findMatch();
});

document.getElementById('cancelSearchBtn').addEventListener('click', () => {
    cancelSearch();
});

document.getElementById('shopBtn').addEventListener('click', () => {
    showScreen('shopScreen');
});

document.getElementById('closeShopBtn').addEventListener('click', () => {
    showScreen('menuScreen');
});

document.getElementById('nextBtn').addEventListener('click', () => {
    nextQuestion();
});

document.getElementById('answerInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        nextQuestion();
    }
});

document.getElementById('playAgainBtn').addEventListener('click', () => {
    findMatch();
});

document.getElementById('backToMenuBtn').addEventListener('click', () => {
    showScreen('menuScreen');
});

document.getElementById('colorPicker').addEventListener('input', updateColorPreview);

// Mode selection
document.getElementById('mode1v1Btn').addEventListener('click', () => {
    currentMode = '1v1';
    document.getElementById('mode1v1Btn').classList.add('active');
    document.getElementById('modeTriosBtn').classList.remove('active');
    document.getElementById('modeSquadBtn').classList.remove('active');
    document.getElementById('modeWhoAmIBtn').classList.remove('active');
    document.getElementById('modeChatBtn').classList.remove('active');
    document.getElementById('findMatchBtn').textContent = 'Find Match (1v1)';
    console.log('🎯 Mode switched to: 1v1');
});

document.getElementById('modeTriosBtn').addEventListener('click', () => {
    currentMode = 'trios';
    document.getElementById('modeTriosBtn').classList.add('active');
    document.getElementById('mode1v1Btn').classList.remove('active');
    document.getElementById('modeSquadBtn').classList.remove('active');
    document.getElementById('modeWhoAmIBtn').classList.remove('active');
    document.getElementById('modeChatBtn').classList.remove('active');
    document.getElementById('findMatchBtn').textContent = 'Find Trios (3 players)';
    console.log('🎯 Mode switched to: Trios');
});

document.getElementById('modeSquadBtn').addEventListener('click', () => {
    currentMode = 'squad';
    document.getElementById('modeSquadBtn').classList.add('active');
    document.getElementById('mode1v1Btn').classList.remove('active');
    document.getElementById('modeTriosBtn').classList.remove('active');
    document.getElementById('modeWhoAmIBtn').classList.remove('active');
    document.getElementById('modeChatBtn').classList.remove('active');
    document.getElementById('findMatchBtn').textContent = 'Find Squad (4 players)';
    console.log('🎯 Mode switched to: Squad');
});

document.getElementById('modeWhoAmIBtn').addEventListener('click', () => {
    currentMode = 'whoami';
    document.getElementById('modeWhoAmIBtn').classList.add('active');
    document.getElementById('mode1v1Btn').classList.remove('active');
    document.getElementById('modeTriosBtn').classList.remove('active');
    document.getElementById('modeSquadBtn').classList.remove('active');
    document.getElementById('modeChatBtn').classList.remove('active');
    document.getElementById('findMatchBtn').textContent = 'Start Who Am I (Mobile)';
    console.log('🎯 Mode switched to: Who Am I');
});

document.getElementById('modeChatBtn').addEventListener('click', () => {
    currentMode = 'chat';
    document.getElementById('modeChatBtn').classList.add('active');
    document.getElementById('mode1v1Btn').classList.remove('active');
    document.getElementById('modeTriosBtn').classList.remove('active');
    document.getElementById('modeSquadBtn').classList.remove('active');
    document.getElementById('modeWhoAmIBtn').classList.remove('active');
    document.getElementById('findMatchBtn').textContent = 'Start Chat';
    console.log('🎯 Mode switched to: Chat');
});

// Chat event listeners
document.getElementById('sendMessageBtn').addEventListener('click', () => {
    sendChatMessage();
});

document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

document.getElementById('skipChatBtn').addEventListener('click', () => {
    skipChatPartner();
});

document.getElementById('leaveChatBtn').addEventListener('click', () => {
    if (confirm('Leave chat and return to menu?')) {
        leaveChat();
    }
});

document.getElementById('addFriendBtn').addEventListener('click', () => {
    sendFriendRequest();
});

// Friend system event listeners
document.getElementById('friendsBtn').addEventListener('click', () => {
    showScreen('friendsScreen');
    loadFriendsList();
    loadFriendRequests();
});

document.getElementById('closeFriendsBtn').addEventListener('click', () => {
    showScreen('menuScreen');
});

document.getElementById('friendsListTab').addEventListener('click', () => {
    document.getElementById('friendsListTab').classList.add('active');
    document.getElementById('friendRequestsTab').classList.remove('active');
    document.getElementById('friendsListContent').style.display = 'block';
    document.getElementById('friendRequestsContent').style.display = 'none';
});

document.getElementById('friendRequestsTab').addEventListener('click', () => {
    document.getElementById('friendRequestsTab').classList.add('active');
    document.getElementById('friendsListTab').classList.remove('active');
    document.getElementById('friendRequestsContent').style.display = 'block';
    document.getElementById('friendsListContent').style.display = 'none';
});

document.getElementById('sendFriendMessageBtn').addEventListener('click', () => {
    sendFriendMessage();
});

document.getElementById('friendChatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendFriendMessage();
    }
});

document.getElementById('leaveFriendChatBtn').addEventListener('click', () => {
    showScreen('friendsScreen');
});

document.getElementById('inviteFriendToGameBtn').addEventListener('click', () => {
    inviteFriendToGame();
});

// Refresh button - forces hard reload to get updates
document.getElementById('refreshBtn').addEventListener('click', () => {
    console.log('🔄 Refreshing app...');

    // Show visual feedback
    const btn = document.getElementById('refreshBtn');
    btn.style.transform = 'rotate(360deg)';

    // Hard refresh after animation
    setTimeout(() => {
        // Clear cache and reload
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
        }

        // Force reload from server (bypass cache)
        window.location.reload(true);
    }, 300);
});

// Initialize
loadPlayerData();
