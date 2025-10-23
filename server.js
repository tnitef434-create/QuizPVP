const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

// Store players and their data
const players = new Map(); // ws -> player data
const waitingPlayers = [];
const activeGames = new Map(); // gameId -> game data

// Player data structure
class Player {
  constructor(ws, username) {
    this.ws = ws;
    this.username = username;
    this.points = 0;
    this.color = '#4A90E2'; // default blue
    this.id = Math.random().toString(36).substr(2, 9);
  }
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

// Generate quiz with 8 questions
function generateQuiz() {
  const questions = [];
  for (let i = 0; i < 8; i++) {
    questions.push(generateQuestion());
  }
  return questions;
}

// Match players
function matchPlayers() {
  while (waitingPlayers.length >= 2) {
    const player1 = waitingPlayers.shift();
    const player2 = waitingPlayers.shift();

    const gameId = Math.random().toString(36).substr(2, 9);
    const questions = generateQuiz();

    const game = {
      id: gameId,
      players: [player1, player2],
      questions: questions,
      scores: { [player1.id]: 0, [player2.id]: 0 },
      answers: { [player1.id]: [], [player2.id]: [] },
      finished: { [player1.id]: false, [player2.id]: false }
    };

    activeGames.set(gameId, game);

    // Send game start to both players
    const gameData = {
      type: 'gameStart',
      gameId: gameId,
      opponent: player2.username,
      opponentColor: player2.color,
      questions: questions.map(q => q.question)
    };

    const gameData2 = {
      type: 'gameStart',
      gameId: gameId,
      opponent: player1.username,
      opponentColor: player1.color,
      questions: questions.map(q => q.question)
    };

    player1.ws.send(JSON.stringify(gameData));
    player2.ws.send(JSON.stringify(gameData2));
  }
}

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    switch(data.type) {
      case 'register':
        const player = new Player(ws, data.username);
        players.set(ws, player);
        ws.send(JSON.stringify({
          type: 'registered',
          playerId: player.id,
          points: player.points,
          color: player.color,
          username: player.username
        }));
        break;

      case 'join':
        const joiningPlayer = players.get(ws);
        if (joiningPlayer && !waitingPlayers.includes(joiningPlayer)) {
          waitingPlayers.push(joiningPlayer);
          ws.send(JSON.stringify({ type: 'searching' }));
          matchPlayers();
        }
        break;

      case 'submitAnswers':
        const submittingPlayer = players.get(ws);
        const game = activeGames.get(data.gameId);

        if (game && submittingPlayer) {
          // Check answers
          let correctCount = 0;
          data.answers.forEach((answer, index) => {
            if (parseInt(answer) === game.questions[index].answer) {
              correctCount++;
            }
          });

          game.scores[submittingPlayer.id] = correctCount;
          game.answers[submittingPlayer.id] = data.answers;
          game.finished[submittingPlayer.id] = true;

          // Check if both players finished
          if (game.finished[game.players[0].id] && game.finished[game.players[1].id]) {
            const player1 = game.players[0];
            const player2 = game.players[1];
            const score1 = game.scores[player1.id];
            const score2 = game.scores[player2.id];

            let winner = null;
            if (score1 > score2) {
              winner = player1;
              player1.points += 100;
            } else if (score2 > score1) {
              winner = player2;
              player2.points += 100;
            }

            // Send results to both players
            const results1 = {
              type: 'gameEnd',
              yourScore: score1,
              opponentScore: score2,
              won: winner === player1,
              draw: winner === null,
              points: player1.points,
              correctAnswers: game.questions.map(q => q.answer)
            };

            const results2 = {
              type: 'gameEnd',
              yourScore: score2,
              opponentScore: score1,
              won: winner === player2,
              draw: winner === null,
              points: player2.points,
              correctAnswers: game.questions.map(q => q.answer)
            };

            player1.ws.send(JSON.stringify(results1));
            player2.ws.send(JSON.stringify(results2));

            activeGames.delete(data.gameId);
          }
        }
        break;

      case 'purchaseUsername':
        const playerChangingName = players.get(ws);
        if (playerChangingName && playerChangingName.points >= 1000) {
          playerChangingName.points -= 1000;
          playerChangingName.username = data.newUsername;
          ws.send(JSON.stringify({
            type: 'purchaseSuccess',
            item: 'username',
            points: playerChangingName.points,
            username: playerChangingName.username
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'purchaseError',
            message: 'Not enough points'
          }));
        }
        break;

      case 'purchaseColor':
        const playerChangingColor = players.get(ws);
        let cost = 0;
        let colorValue = data.color;

        if (data.color === 'custom') {
          cost = 5000;
          colorValue = data.customColor;
        } else if (data.color === 'gold') {
          cost = 10000;
          colorValue = 'gold';
        } else if (data.color === 'rainbow') {
          cost = 50000;
          colorValue = 'rainbow';
        }

        if (playerChangingColor && playerChangingColor.points >= cost) {
          playerChangingColor.points -= cost;
          playerChangingColor.color = colorValue;
          ws.send(JSON.stringify({
            type: 'purchaseSuccess',
            item: 'color',
            points: playerChangingColor.points,
            color: playerChangingColor.color
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'purchaseError',
            message: 'Not enough points'
          }));
        }
        break;
    }
  });

  ws.on('close', () => {
    const player = players.get(ws);
    if (player) {
      const index = waitingPlayers.indexOf(player);
      if (index > -1) {
        waitingPlayers.splice(index, 1);
      }
      players.delete(ws);
    }
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
