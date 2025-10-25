# QuizPVP - Math Battle Arena 🎮

A **production-ready** real-time multiplayer math quiz game where players from different computers battle in 1v1 math quizzes! Built with Firebase Realtime Database - works entirely in the browser!

## 🚀 Play Now

**[LIVE DEMO](https://tnitef434-create.github.io/QuizPVP/)** (Replace with your GitHub Pages URL)

Or test locally by opening `index.html` in your browser!

## ✨ Features (v2.0.0)

- ✅ **Real Cross-PC Multiplayer** - Players on different computers can play together
- ✅ **Live Player Count** - See how many players are online in real-time
- ✅ **Connection Status** - Know when you're connected/disconnected
- ✅ **Automatic Matchmaking** - Find opponents instantly
- ✅ **Points & Shop System** - Earn points, customize your profile
- ✅ **Special Effects** - Gold and Rainbow color effects
- ✅ **Production Ready** - Deploy to GitHub Pages in 5 minutes

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
3. **Find Match**: Click "Find Match" to start searching for an opponent
4. **Answer Questions**: You'll get 8 math questions to solve as fast as you can
5. **See Results**: After both players finish, see who won and earn your points!
6. **Visit Shop**: Use your points to customize your username and color

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Firebase Realtime Database
- **Hosting**: Works on any static host (GitHub Pages, Netlify, etc.)

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
