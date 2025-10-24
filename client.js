// ===== FIREBASE CONFIGURATION =====
// Firebase is configured to work with your database at:
// https://quizpvp-5a2e2-default-rtdb.europe-west1.firebasedatabase.app

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
    // Initialize Firebase App
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    database = firebase.database();
    connectedRef = database.ref('.info/connected');

    console.log('✅ Firebase app initialized');
    console.log('🌐 Database URL:', firebaseConfig.databaseURL);

    // Sign in anonymously to satisfy database rules
    auth.signInAnonymously()
        .then(() => {
            console.log('✅ Signed in anonymously');
            isFirebaseReady = true;

            // Test connection after authentication
            database.ref('.info/connected').on('value', (snapshot) => {
                if (snapshot.val() === true) {
                    console.log('✅ Connected to Firebase Database!');
                } else {
                    console.log('⚠️ Not connected to Firebase');
                }
            });
        })
        .catch((error) => {
            console.error('❌ Anonymous authentication failed:', error);
            alert('Failed to authenticate with game server.\n\nError: ' + error.message);
            isFirebaseReady = false;
        });

    // Monitor authentication state
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('✅ User authenticated:', user.uid);
            isFirebaseReady = true;
        } else {
            console.log('⚠️ User not authenticated');
            isFirebaseReady = false;
        }
    });

} catch (error) {
    console.error('❌ Firebase initialization error:', error);
    alert('Failed to connect to game server. Please check your internet connection.\n\nError: ' + error.message);
    isFirebaseReady = false;
}

let playerData = {
    username: '',
    points: 0,
    color: '#4A90E2',
    id: ''
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

// Load player data from localStorage
function loadPlayerData() {
    const saved = localStorage.getItem('quizpvp_player');
    if (saved) {
        const data = JSON.parse(saved);
        playerData.points = data.points || 0;
        playerData.color = data.color || '#4A90E2';
        playerData.id = data.id || generateId();
        playerData.username = data.username || ''; // Load saved username

        // If username exists, skip to menu and setup
        if (playerData.username && playerData.username.length >= 2) {
            console.log('✅ Loaded saved username:', playerData.username);
            updatePlayerDisplay();
            showScreen('menuScreen');
            setupPlayerPresence();
            trackActivePlayerCount();
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
        username: playerData.username // Save username too
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
    if (game.player1.finished && game.player2.finished) {
        // All players finished! Try to sync results display
        if (!game.resultsReadyAt) {
            try {
                await database.ref(`games/${currentGame.gameId}/resultsReadyAt`).set(Date.now());
                return; // Wait for the timestamp to propagate
            } catch (error) {
                console.warn('⚠️ Could not set results timestamp, showing results immediately:', error);
                // Continue to show results anyway (fallback to immediate display)
            }
        }

        // Results are ready! Show them now
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
        // Add win notification
        addNotification('win', 'Trios Victory!', `You won Trios mode with a score of ${myPlayer.score} and earned 100 points!`);
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
        // Add win notification
        addNotification('win', 'Squad Victory!', `You won Squad mode with a score of ${myPlayer.score} and earned 100 points!`);
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
        // Add win notification
        addNotification('win', 'Victory!', `You won with a score of ${myScore}-${opponentScore} and earned 100 points!`);
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

// Event listeners
document.getElementById('joinBtn').addEventListener('click', () => {
    const username = document.getElementById('usernameInput').value.trim();

    if (username.length < 2) {
        alert('Please enter a username (at least 2 characters)');
        return;
    }

    playerData.username = username;
    savePlayerData(); // Save username persistently
    updatePlayerDisplay();
    showScreen('menuScreen');

    // Setup player presence and tracking
    setupPlayerPresence();
    trackActivePlayerCount();

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

// ===== NEW FEATURES FUNCTIONALITY =====

// Level System
function calculateLevel(points) {
    // Level formula: Level = floor(points / 1000) + 1
    return Math.floor(points / 1000) + 1;
}

function calculateLevelProgress(points) {
    // Progress within current level (0-100%)
    const pointsInLevel = points % 1000;
    return (pointsInLevel / 1000) * 100;
}

function updateLevelDisplay() {
    const level = calculateLevel(playerData.points);
    const progress = calculateLevelProgress(playerData.points);

    document.getElementById('playerLevel').textContent = level;
    document.getElementById('levelFill').style.width = progress + '%';
}

// Inbox/Notification System
let notifications = [];

function loadNotifications() {
    const stored = localStorage.getItem('quizpvp_notifications');
    if (stored) {
        notifications = JSON.parse(stored);
        updateInboxBadge();
    }
}

function saveNotifications() {
    localStorage.setItem('quizpvp_notifications', JSON.stringify(notifications));
    updateInboxBadge();
}

function addNotification(type, title, message) {
    const notification = {
        id: generateId(),
        type: type, // 'friend', 'win', 'update'
        title: title,
        message: message,
        time: Date.now(),
        read: false
    };

    notifications.unshift(notification);
    saveNotifications();
}

function updateInboxBadge() {
    const unreadCount = notifications.filter(n => !n.read).length;
    const badge = document.getElementById('inboxBadge');

    if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function showInbox() {
    showScreen('inboxScreen');
    renderNotifications('all');
}

function renderNotifications(filter) {
    const content = document.getElementById('inboxContent');
    let filtered = notifications;

    if (filter === 'friends') {
        filtered = notifications.filter(n => n.type === 'friend');
    } else if (filter === 'wins') {
        filtered = notifications.filter(n => n.type === 'win');
    } else if (filter === 'updates') {
        filtered = notifications.filter(n => n.type === 'update');
    }

    if (filtered.length === 0) {
        content.innerHTML = `
            <div class="inbox-empty">
                <span class="inbox-empty-icon">📭</span>
                <p>No notifications yet</p>
            </div>
        `;
        return;
    }

    content.innerHTML = filtered.map(n => {
        const icon = n.type === 'friend' ? '👤' :
                    n.type === 'win' ? '🏆' : '🎉';
        const timeAgo = getTimeAgo(n.time);

        return `
            <div class="notification-item ${n.read ? '' : 'unread'}" onclick="markNotificationRead('${n.id}')">
                <div class="notification-icon">${icon}</div>
                <div class="notification-content">
                    <div class="notification-title">${n.title}</div>
                    <div class="notification-message">${n.message}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
}

function markNotificationRead(id) {
    const notification = notifications.find(n => n.id === id);
    if (notification) {
        notification.read = true;
        saveNotifications();
        renderNotifications(currentInboxTab);
    }
}

function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    return Math.floor(seconds / 86400) + ' days ago';
}

let currentInboxTab = 'all';

// Inbox tab switching
document.querySelectorAll('.inbox-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.inbox-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentInboxTab = tab.dataset.tab;
        renderNotifications(currentInboxTab);
    });
});

// Inbox button
document.getElementById('inboxBtn').addEventListener('click', showInbox);

document.getElementById('closeInboxBtn').addEventListener('click', () => {
    showScreen('menuScreen');
});

// Settings Screen
document.getElementById('settingsBtn').addEventListener('click', () => {
    showScreen('settingsScreen');
});

document.getElementById('closeSettingsBtn').addEventListener('click', () => {
    showScreen('menuScreen');
});

// Friend Search System
async function searchFriend() {
    const searchInput = document.getElementById('friendSearchInput');
    const searchTerm = searchInput.value.trim().toLowerCase();
    const resultsDiv = document.getElementById('friendSearchResults');

    if (searchTerm.length < 2) {
        resultsDiv.innerHTML = '<div class="friend-search-empty">Enter at least 2 characters to search</div>';
        return;
    }

    if (searchTerm === playerData.username.toLowerCase()) {
        resultsDiv.innerHTML = '<div class="friend-search-empty">You cannot add yourself!</div>';
        return;
    }

    resultsDiv.innerHTML = '<div class="friend-search-empty">Searching...</div>';

    try {
        // Search in online players first
        const onlineSnapshot = await get(ref(db, 'online'));
        const players = [];

        if (onlineSnapshot.exists()) {
            const onlineData = onlineSnapshot.val();
            Object.entries(onlineData).forEach(([id, player]) => {
                if (player.username &&
                    player.username.toLowerCase().includes(searchTerm) &&
                    id !== playerData.id) {
                    players.push({
                        id: id,
                        username: player.username,
                        color: '#4A90E2', // Default color
                        online: true
                    });
                }
            });
        }

        if (players.length === 0) {
            resultsDiv.innerHTML = '<div class="friend-search-empty">No players found with that username</div>';
            return;
        }

        resultsDiv.innerHTML = players.map(player => {
            const colorStyle = getColorStyle(player.color);
            return `
                <div class="friend-result-item">
                    <div class="friend-result-info">
                        <div class="friend-result-avatar" style="${colorStyle}"></div>
                        <div class="friend-result-name">${escapeHtml(player.username)}</div>
                        ${player.online ? '<span style="color: #10b981;">● Online</span>' : ''}
                    </div>
                    <div class="friend-result-actions">
                        <button class="btn btn-primary btn-small" onclick="sendFriendRequest('${player.id}', '${escapeHtml(player.username)}')">
                            Add Friend
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Search error:', error);
        resultsDiv.innerHTML = '<div class="friend-search-empty">Search failed. Please try again.</div>';
    }
}

function sendFriendRequest(friendId, friendUsername) {
    // Add notification to current user
    addNotification('friend', 'Friend Request Sent', `You sent a friend request to ${friendUsername}`);

    // In a full implementation, this would send a request to Firebase
    // For now, we'll just show a success message
    alert(`Friend request sent to ${friendUsername}! (Note: Full friend system coming in next update)`);
}

document.getElementById('searchFriendBtn').addEventListener('click', searchFriend);

document.getElementById('friendSearchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchFriend();
    }
});

// Add welcome notification on first load
function checkFirstLoad() {
    const hasSeenWelcome = localStorage.getItem('quizpvp_seen_welcome_v2.6');
    if (!hasSeenWelcome) {
        addNotification('update', 'Welcome to QuizPVP v2.6.0!',
            'Check out new features: Inbox notifications, friend search, level system, and upcoming modes!');
        localStorage.setItem('quizpvp_seen_welcome_v2.6', 'true');
    }
}

// Override the original updatePlayerDisplay to include level
const originalUpdatePlayerDisplay = updatePlayerDisplay;
updatePlayerDisplay = function() {
    originalUpdatePlayerDisplay();
    updateLevelDisplay();
};

// Override points update to trigger level display update
const originalSavePlayerData = savePlayerData;
savePlayerData = function() {
    originalSavePlayerData();
    updateLevelDisplay();
};

// Initialize
loadPlayerData();
loadNotifications();
checkFirstLoad();
updateLevelDisplay();
