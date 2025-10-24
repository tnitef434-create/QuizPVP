# QuizPVP - Math Battle Arena 🎮

A **production-ready** real-time multiplayer math quiz game where players from different computers battle in 1v1 math quizzes! Built with Firebase Realtime Database - works entirely in the browser!

## 🚀 Play Now

**[LIVE DEMO](https://tnitef434-create.github.io/QuizPVP/)** (Replace with your GitHub Pages URL)

Or test locally by opening `index.html` in your browser!

## ✨ Features (v2.6.0)

- ✅ **Real Cross-PC Multiplayer** - Players on different computers can play together
- ✅ **5 Game Modes** - 1v1, Trios, Squad, Who Am I (mobile tilt), and Chat (BETA)
- ✅ **Notification System** - Track friend requests, wins, and updates in your inbox
- ✅ **Friend Search** - Search and add friends by username
- ✅ **Level Progression** - Visual level system that grows with your points
- ✅ **Live Player Count** - See how many players are online in real-time
- ✅ **Connection Status** - Know when you're connected/disconnected
- ✅ **Points & Shop System** - Earn points, customize your profile
- ✅ **Special Effects** - Gold and Rainbow color effects
- ✅ **Production Ready** - Deploy to GitHub Pages in 5 minutes

## Features

### Game Modes
- **1v1 Mode**: Classic head-to-head math battle with 8 questions
- **Trios Mode**: Compete against 2 other players for the top spot
- **Squad Mode**: 4-player competition with full leaderboard
- **Who Am I Mode**: Mobile-only tilt game - guess words by tilting your device
- **Chat Mode (BETA)**: Chat with random players in real-time
- **Coming Soon**: WarMap and Race Mode!

### Game Mechanics
- **Real-time Matchmaking**: Automatically matches you with other online players using Firebase
- **Point System**: Earn 100 points for each victory
- **Level Progression**: Level up as you earn points (1 level per 1,000 points)
- **Notification System**: Get notified of wins, friend requests, and updates
- **Friend Search**: Search for players by username and add them as friends
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

## 🎯 How It Works

This is a **100% static site** - no backend server to maintain!

- **Firebase Realtime Database** - Handles all multiplayer logic
- **Player Presence System** - Tracks who's online with automatic cleanup
- **Cross-PC Communication** - Players on different computers are matched through Firebase
- **Local Storage** - Points and colors saved in your browser
- **GitHub Pages** - Free hosting, works from anywhere

## 🚀 Quick Start (5 Minutes to Production!)

### Step 1: Set Up Firebase (Required)

**The game needs Firebase to work.** Don't worry, it's FREE and takes 5 minutes!

📖 **[Follow the Complete Firebase Setup Guide →](FIREBASE_SETUP.md)**

Quick summary:
1. Create free Firebase project
2. Enable Realtime Database
3. Copy your config to `client.js`
4. Done!

### Step 2: Deploy to GitHub Pages

1. Push your code to GitHub
2. Go to **Settings → Pages**
3. Set source to your branch (e.g., `main` or `claude/multiplayer-math-quiz-...`)
4. Wait 1-2 minutes
5. Your game is live at: `https://[your-username].github.io/QuizPVP`

**Share the link and start playing!** 🎉

## Local Testing

Simply open `index.html` in any modern web browser. Open multiple tabs to test multiplayer functionality.

## How to Play

1. **Enter Username**: Type your desired username on the welcome screen
2. **Click Join**: This saves your profile locally
3. **Select Mode**: Choose from 1v1, Trios, Squad, Who Am I (mobile), or Chat (BETA)
4. **Find Match**: Click "Find Match" to start searching for opponents
5. **Answer Questions**: Solve math questions as fast as you can
6. **See Results**: After the game finishes, see who won and earn your points!
7. **Check Notifications**: Click the inbox icon to see your wins and friend requests
8. **Find Friends**: Use Settings → Find Friends to search for players by username
9. **Visit Shop**: Use your points to customize your username and color
10. **Track Progress**: Watch your level increase as you earn points!

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
- Full friend system (friend requests, friend list, friend battles)
- Different difficulty levels
- WarMap mode implementation
- Race Mode implementation
- Achievement system
- Private rooms/game codes
- Tournament mode

## License

MIT License - Feel free to use and modify!

---

Made with ❤️ for math enthusiasts and competitive gamers!
