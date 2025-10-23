# QuizPVP - Math Battle Arena

A real-time multiplayer math quiz game where players compete in 1v1 battles to test their arithmetic skills!

## Features

### Game Mechanics
- **Real-time Matchmaking**: Automatically matches you with other online players
- **1v1 Math Quiz**: Face off against opponents in quick 8-question math quizzes
- **Point System**: Earn 100 points for each victory
- **Simple Operations**: Questions include addition, subtraction, and multiplication

### Customization Shop
Spend your hard-earned points to customize your profile:
- **Username Change** (1,000 points): Choose a new username
- **Custom Color** (5,000 points): Pick any color you like
- **Gold Color** (10,000 points): Shine with a special gold gradient
- **Rainbow Color** (50,000 points): Stand out with an animated rainbow effect

### Design
- Clean, modern interface with smooth animations
- Vibrant gradient backgrounds
- Responsive design that works on all devices
- Fun, engaging visual feedback

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Setup Instructions

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

### For Development
Use nodemon for auto-reloading during development:
```bash
npm run dev
```

## How to Play

1. **Enter Username**: Type your desired username on the welcome screen
2. **Click Join**: This registers you in the system
3. **Find Match**: Click "Find Match" to start searching for an opponent
4. **Answer Questions**: You'll get 8 math questions to solve as fast as you can
5. **See Results**: After both players finish, see who won and earn your points!
6. **Visit Shop**: Use your points to customize your username and color

## Technology Stack

- **Backend**: Node.js, Express, WebSocket (ws library)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Real-time Communication**: WebSocket for instant multiplayer updates

## Game Architecture

### Server (`server.js`)
- Manages WebSocket connections
- Handles player registration and matchmaking
- Generates random math questions
- Validates answers and determines winners
- Manages the shop and point system

### Client (`public/client.js`)
- WebSocket client for real-time communication
- Game state management
- UI updates and screen transitions
- Shop functionality

## Project Structure

```
QuizPVP/
├── server.js              # WebSocket server and game logic
├── package.json           # Project dependencies
├── README.md             # This file
└── public/               # Frontend files
    ├── index.html        # Main HTML structure
    ├── style.css         # Styles and animations
    └── client.js         # Client-side game logic
```

## Tips for Playing

- Answer quickly but accurately - speed doesn't matter if you get answers wrong!
- Multiplication questions tend to be worth the same as addition, but might take more thought
- Save up for the rainbow color - it's the ultimate flex!
- Practice your mental math to dominate the leaderboard

## Future Enhancements

Potential features for future versions:
- Global leaderboard
- Friend system and private matches
- Multiple difficulty levels
- Different game modes (speed rounds, sudden death, etc.)
- Achievement system
- Profile statistics and win/loss records

## Development Notes

The game uses a simple but effective architecture:
- WebSocket ensures real-time, bidirectional communication
- Game state is managed on both client and server for validation
- Questions are generated server-side to prevent cheating
- Points are stored server-side (in-memory for this version)

## Troubleshooting

**Can't connect to the server?**
- Make sure the server is running (`npm start`)
- Check that port 3000 is not being used by another application

**Not finding matches?**
- Open multiple browser windows/tabs to simulate multiple players
- The game needs at least 2 players in the waiting queue to start a match

**WebSocket connection issues?**
- Check your firewall settings
- Ensure WebSocket connections are not being blocked

## License

MIT License - Feel free to use and modify as you wish!

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

---

Made with ❤️ for math enthusiasts and competitive gamers!
