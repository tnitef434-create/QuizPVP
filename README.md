# QuizPVP - Math Battle Arena

A real-time multiplayer math quiz game where players compete in 1v1 battles! Works entirely in your browser via GitHub Pages - no server setup required!

## Play Now

Just open `index.html` in your browser or visit the GitHub Pages URL once deployed!

## Features

### Game Mechanics
- **Real-time Matchmaking**: Automatically matches you with other online players using Firebase
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

## How It Works

This is a **100% static site** that uses **Firebase Realtime Database** for multiplayer functionality. No backend server needed!

- Player data (points, color) is stored locally in your browser
- Matchmaking and game sessions are managed through Firebase
- All players connect to the same Firebase database to find opponents

## Setup for GitHub Pages

1. Push this code to your GitHub repository
2. Go to Settings → Pages
3. Set source to main branch
4. Your game will be live at: `https://[username].github.io/[repo-name]`

That's it! Anyone can play just by visiting the URL.

## Local Testing

Simply open `index.html` in any modern web browser. Open multiple tabs to test multiplayer functionality.

## How to Play

1. **Enter Username**: Type your desired username on the welcome screen
2. **Click Join**: This saves your profile locally
3. **Find Match**: Click "Find Match" to start searching for an opponent
4. **Answer Questions**: You'll get 8 math questions to solve as fast as you can
5. **See Results**: After both players finish, see who won and earn your points!
6. **Visit Shop**: Use your points to customize your username and color

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Firebase Realtime Database
- **Hosting**: Works on any static host (GitHub Pages, Netlify, etc.)

## Firebase Configuration

The game uses a pre-configured Firebase project. The configuration is in `client.js`. You can use the included config or replace it with your own Firebase project:

1. Create a Firebase project at https://firebase.google.com
2. Enable Realtime Database
3. Set database rules to allow read/write (for testing)
4. Replace the config in `client.js` with your project's config

### Recommended Firebase Rules

For production, use these security rules:

```json
{
  "rules": {
    "waiting": {
      ".read": true,
      ".write": true,
      "$playerId": {
        ".validate": "newData.hasChildren(['username', 'color', 'timestamp'])"
      }
    },
    "games": {
      ".read": true,
      ".write": true
    }
  }
}
```

## Project Structure

```
QuizPVP/
├── index.html        # Main HTML structure with all screens
├── style.css         # Styles and animations
├── client.js         # Game logic and Firebase integration
├── package.json      # Project metadata
└── README.md         # This file
```

## Features Breakdown

### Matchmaking System
- Players join a waiting queue in Firebase
- First available player is matched automatically
- Stale entries (>30 seconds) are cleaned up
- Real-time listener notifies when match is found

### Game Flow
1. Match found → Questions generated
2. Both players answer same 8 questions
3. Answers submitted to Firebase
4. When both finish → Scores compared
5. Winner gets 100 points
6. Game cleanup after 30 seconds

### Persistence
- Points and colors saved in localStorage
- Persists across sessions
- Each player has unique ID

## Tips for Playing

- Answer quickly but accurately - speed doesn't matter if you get them wrong!
- Multiplication questions are worth the same as addition
- Save up for the rainbow color - it's the ultimate flex!
- Practice your mental math to dominate

## Browser Compatibility

Works in all modern browsers:
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Contributing

Feel free to fork and improve! Some ideas:
- Global leaderboard
- Friend system
- Different difficulty levels
- More game modes
- Achievement system

## License

MIT License - Feel free to use and modify!

---

Made with ❤️ for math enthusiasts and competitive gamers!
