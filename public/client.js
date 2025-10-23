let ws;
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
    opponentColor: ''
};

// Screen management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Connect to WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Connected to server');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    };

    ws.onclose = () => {
        console.log('Disconnected from server');
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Handle server messages
function handleServerMessage(data) {
    switch(data.type) {
        case 'registered':
            playerData.id = data.playerId;
            playerData.points = data.points;
            playerData.color = data.color;
            playerData.username = data.username;
            updatePlayerDisplay();
            showScreen('menuScreen');
            break;

        case 'searching':
            showScreen('searchingScreen');
            break;

        case 'gameStart':
            currentGame.gameId = data.gameId;
            currentGame.questions = data.questions;
            currentGame.opponent = data.opponent;
            currentGame.opponentColor = data.opponentColor;
            currentGame.answers = [];
            currentGame.currentQuestionIndex = 0;
            startGame();
            break;

        case 'gameEnd':
            showResults(data);
            break;

        case 'purchaseSuccess':
            if (data.item === 'username') {
                playerData.username = data.username;
            } else if (data.item === 'color') {
                playerData.color = data.color;
            }
            playerData.points = data.points;
            updatePlayerDisplay();
            closeModal();
            alert('Purchase successful!');
            break;

        case 'purchaseError':
            alert(data.message);
            break;
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

// Get color style (handles rainbow and gold)
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

// Start game
function startGame() {
    showScreen('gameScreen');

    // Setup player displays
    document.getElementById('yourName').textContent = playerData.username;
    document.getElementById('opponentName').textContent = currentGame.opponent;

    const yourAvatar = document.getElementById('yourAvatar');
    const opponentAvatar = document.getElementById('opponentAvatar');

    applyAvatarStyle(yourAvatar, playerData.color);
    applyAvatarStyle(opponentAvatar, currentGame.opponentColor);

    // Show first question
    showQuestion();
}

// Show question
function showQuestion() {
    const index = currentGame.currentQuestionIndex;
    const question = currentGame.questions[index];

    document.getElementById('questionText').textContent = question;
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
        ws.send(JSON.stringify({
            type: 'submitAnswers',
            gameId: currentGame.gameId,
            answers: currentGame.answers
        }));

        // Show waiting screen
        showScreen('searchingScreen');
        document.querySelector('.searching-animation h2').textContent = 'Calculating Results...';
        document.querySelector('.searching-text').textContent = 'Waiting for opponent to finish';
    }
}

// Show results
function showResults(data) {
    showScreen('resultsScreen');

    // Reset searching screen text
    document.querySelector('.searching-animation h2').textContent = 'Finding Opponent...';
    document.querySelector('.searching-text').textContent = 'Matching you with another player';

    const resultBanner = document.getElementById('resultBanner');

    if (data.won) {
        resultBanner.textContent = 'YOU WIN!';
        resultBanner.className = 'result-banner win';
    } else if (data.draw) {
        resultBanner.textContent = "IT'S A DRAW!";
        resultBanner.className = 'result-banner draw';
    } else {
        resultBanner.textContent = 'YOU LOSE';
        resultBanner.className = 'result-banner lose';
    }

    document.getElementById('yourScore').textContent = data.yourScore;
    document.getElementById('opponentScore').textContent = data.opponentScore;

    // Show points earned
    const pointsEarned = document.getElementById('pointsEarned');
    if (data.won) {
        pointsEarned.textContent = '+100 points earned!';
        pointsEarned.style.display = 'block';
    } else {
        pointsEarned.style.display = 'none';
    }

    // Update player points
    playerData.points = data.points;
    updatePlayerDisplay();

    // Show answer review
    const answersReview = document.getElementById('answersReview');
    answersReview.innerHTML = '<h3 style="margin-bottom: 15px;">Answer Review</h3>';

    currentGame.questions.forEach((question, index) => {
        const userAnswer = currentGame.answers[index];
        const correctAnswer = data.correctAnswers[index];
        const isCorrect = parseInt(userAnswer) === correctAnswer;

        const answerItem = document.createElement('div');
        answerItem.className = `answer-item ${isCorrect ? 'correct' : 'incorrect'}`;
        answerItem.innerHTML = `
            <span><strong>Q${index + 1}:</strong> ${question}</span>
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

    ws.send(JSON.stringify({
        type: 'purchaseUsername',
        newUsername: newUsername
    }));
}

function confirmColorChange() {
    const color = document.getElementById('colorPicker').value;

    ws.send(JSON.stringify({
        type: 'purchaseColor',
        color: 'custom',
        customColor: color
    }));
}

function purchaseColor(colorType) {
    let cost = 0;
    if (colorType === 'gold') {
        cost = 10000;
    } else if (colorType === 'rainbow') {
        cost = 50000;
    }

    if (playerData.points < cost) {
        alert(`Not enough points! You need ${cost.toLocaleString()} points.`);
        return;
    }

    if (confirm(`Purchase ${colorType} color for ${cost.toLocaleString()} points?`)) {
        ws.send(JSON.stringify({
            type: 'purchaseColor',
            color: colorType
        }));
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

    ws.send(JSON.stringify({
        type: 'register',
        username: username
    }));
});

document.getElementById('usernameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('joinBtn').click();
    }
});

document.getElementById('findMatchBtn').addEventListener('click', () => {
    ws.send(JSON.stringify({
        type: 'join'
    }));
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
    ws.send(JSON.stringify({
        type: 'join'
    }));
});

document.getElementById('backToMenuBtn').addEventListener('click', () => {
    showScreen('menuScreen');
});

document.getElementById('colorPicker').addEventListener('input', updateColorPreview);

// Initialize
connectWebSocket();
