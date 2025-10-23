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
    // DEMO CONFIG - Replace with your own Firebase project for production!
    apiKey: "AIzaSyDGxm8Yn7z_PqKF7LrYBvN3J8mK4xQp1Wc",
    authDomain: "quizpvp-demo.firebaseapp.com",
    databaseURL: "https://quizpvp-demo-default-rtdb.firebaseio.com",
    projectId: "quizpvp-demo",
    storageBucket: "quizpvp-demo.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:1a2b3c4d5e6f7g8h9i0j"
};

// Initialize Firebase
let database;
let connectedRef;
let myConnectionRef;

try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    connectedRef = database.ref('.info/connected');
    console.log('✅ Firebase initialized successfully');
    console.log('🌐 Database URL:', firebaseConfig.databaseURL);
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
    alert('Failed to connect to game server. Please check your internet connection and refresh the page.');
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
    opponentUsername: ''
};

let gameListener = null;
let searchListener = null;
let activePlayersCount = 0;

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
    } else {
        playerData.id = generateId();
    }
}

// Save player data to localStorage
function savePlayerData() {
    localStorage.setItem('quizpvp_player', JSON.stringify({
        points: playerData.points,
        color: playerData.color,
        id: playerData.id
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

// Find match
async function findMatch() {
    console.log('🔍 Starting matchmaking for player:', playerData.username);
    showScreen('searchingScreen');

    try {
        // Clean up old waiting entries
        const waitingRef = database.ref('waiting');
        console.log('📡 Checking waiting queue...');
        const snapshot = await waitingRef.once('value');
        const waiting = snapshot.val() || {};
        console.log('Waiting players:', Object.keys(waiting).length);

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
                createdAt: Date.now()
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
                    database.ref(`waiting/${playerData.id}`).remove();

                    startGame(game.id, game);
                }
            });
        }
    } catch (error) {
        console.error('❌ Matchmaking error:', error);
        alert('Failed to find match. Please check your connection and try again.');
        showScreen('menuScreen');
    }
}

// Start game
function startGame(gameId, gameData) {
    currentGame.gameId = gameId;
    currentGame.questions = gameData.questions;
    currentGame.answers = [];
    currentGame.currentQuestionIndex = 0;

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

    // Listen for game updates
    gameListener = database.ref(`games/${gameId}`).on('value', (snapshot) => {
        const game = snapshot.val();
        if (game) {
            checkGameEnd(game);
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
    // Calculate score
    let score = 0;
    currentGame.answers.forEach((answer, index) => {
        if (parseInt(answer) === currentGame.questions[index].answer) {
            score++;
        }
    });

    // Update Firebase
    const isPlayer1 = await checkIfPlayer1();
    const playerKey = isPlayer1 ? 'player1' : 'player2';

    await database.ref(`games/${currentGame.gameId}/${playerKey}`).update({
        score: score,
        answers: currentGame.answers,
        finished: true
    });

    // Show waiting screen
    showScreen('searchingScreen');
    document.querySelector('.searching-animation h2').textContent = 'Calculating Results...';
    document.querySelector('.searching-text').textContent = 'Waiting for opponent to finish';
}

// Check if player1
async function checkIfPlayer1() {
    const snapshot = await database.ref(`games/${currentGame.gameId}/player1/id`).once('value');
    return snapshot.val() === playerData.id;
}

// Check if game ended
function checkGameEnd(game) {
    if (game.player1.finished && game.player2.finished) {
        // Game ended!
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

// Show results
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

// Event listeners
document.getElementById('joinBtn').addEventListener('click', () => {
    const username = document.getElementById('usernameInput').value.trim();

    if (username.length < 2) {
        alert('Please enter a username (at least 2 characters)');
        return;
    }

    playerData.username = username;
    updatePlayerDisplay();
    showScreen('menuScreen');

    // Setup player presence and tracking
    setupPlayerPresence();
    trackActivePlayerCount();

    // Clean up old games periodically
    cleanupOldGames();
    setInterval(cleanupOldGames, 60000); // Every minute

    console.log('✅ Player registered:', username);
});

document.getElementById('usernameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('joinBtn').click();
    }
});

document.getElementById('findMatchBtn').addEventListener('click', () => {
    findMatch();
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

// Initialize
loadPlayerData();
