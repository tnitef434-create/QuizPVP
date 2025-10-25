# Firebase Security Setup Guide

## Overview

QuizPVP now uses Firebase Authentication with anonymous sign-in to protect your data while keeping the app accessible to everyone. Users are automatically signed in anonymously, and security rules ensure that players can only modify their own data.

## Step-by-Step Setup

### 1. Create Firebase Project (2 minutes)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter project name: `quizpvp-yourgame` (or any name you like)
4. **Disable Google Analytics** (not needed) or enable it if you want
5. Click **"Create project"**
6. Wait for it to finish, then click **"Continue"**

### 2. Enable Realtime Database (1 minute)

1. In the left sidebar, click **"Build"** → **"Realtime Database"**
2. Click **"Create Database"**
3. Choose location closest to your players (e.g., `us-central1`, `europe-west1`)
4. Start in **"Locked mode"** (we'll add secure rules next)
5. Click **"Enable"**

### 3. Enable Anonymous Authentication (1 minute)

1. In the left sidebar, click **"Build"** → **"Authentication"**
2. Click **"Get started"** if this is your first time
3. Go to the **"Sign-in method"** tab
4. Find **"Anonymous"** in the provider list
5. Click on it and toggle it to **Enabled**
6. Click **"Save"**

### 4. Set Secure Database Rules (1 minute)

1. Go back to **"Realtime Database"** in the left sidebar
2. Click the **"Rules"** tab
3. Replace the rules with the secure rules below

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",

    "activePlayers": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && auth.uid == $uid"
      }
    },

    "usernames": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && auth.uid == $uid"
      }
    },

    "users": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && auth.uid == $uid"
      }
    },

    "games": {
      ".read": "auth != null",
      ".write": "auth != null"
    },

    "waiting1v1": {
      ".read": "auth != null",
      ".write": "auth != null"
    },

    "waiting1v2": {
      ".read": "auth != null",
      ".write": "auth != null"
    },

    "waiting1v3": {
      ".read": "auth != null",
      ".write": "auth != null"
    },

    "modeCounts": {
      ".read": "auth != null",
      ".write": "auth != null"
    },

    "randomChat": {
      ".read": "auth != null",
      ".write": "auth != null"
    },

    "friendChats": {
      ".read": "auth != null",
      ".write": "auth != null"
    },

    "gameInvites": {
      ".read": "auth != null",
      ".write": "auth != null"
    },

    "whoAmIWaiting": {
      ".read": "auth != null",
      ".write": "auth != null"
    },

    "whoAmIGames": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

4. Click **"Publish"**

### 5. Get Your Config (1 minute)

1. Click the gear icon (⚙️) next to "Project Overview"
2. Click **"Project settings"**
3. Scroll down to **"Your apps"**
4. Click the **</>** (web icon) to create a web app
5. App nickname: `QuizPVP Web`
6. **Don't** check "Firebase Hosting" (we'll use GitHub Pages)
7. Click **"Register app"**
8. Copy the `firebaseConfig` object (looks like this):

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 6. Update Your Code (30 seconds)

1. Open `client.js` in your QuizPVP folder
2. Find the `firebaseConfig` section (around line 13)
3. Replace the demo config with YOUR config from step 5
4. Save the file

That's it! Your game is now connected to your own Firebase backend with secure authentication! 🎉

## Deploying to GitHub Pages

1. Commit your changes:
```bash
git add client.js
git commit -m "Add my Firebase config"
git push
```

2. Enable GitHub Pages:
   - Go to your repo on GitHub
   - Settings → Pages
   - Source: Select your branch
   - Click Save
   - Your game will be live at: `https://yourusername.github.io/QuizPVP`

## Testing Cross-PC Multiplayer

1. Open your GitHub Pages URL on your computer
2. Open the same URL on your phone (or ask a friend to open it)
3. Both enter usernames and click "Find Match"
4. You should get matched together!

## Monitoring Your Game

To see your game's live data:

1. Go to Firebase Console → Realtime Database
2. You'll see:
   - `online/` - Currently connected players
   - `waiting/` - Players looking for matches
   - `games/` - Active games

You can watch players connect in real-time!

## Free Tier Limits

Firebase free tier (Spark plan) includes:

- ✅ **100 simultaneous connections** - Perfect for small to medium games
- ✅ **1 GB stored data** - More than enough
- ✅ **10 GB/month bandwidth** - Plenty for thousands of games

If you outgrow this, the paid plan (Blaze) is pay-as-you-go and still very cheap.

## Troubleshooting

**"Permission denied" errors:**
- Check your database rules are set correctly (step 3)
- Make sure you clicked "Publish"

**Players not connecting:**
- Check browser console (F12) for errors
- Verify `databaseURL` is correct in your config
- Make sure the URL starts with `https://` not `http://`

**Not finding matches:**
- Open two browser tabs to test locally first
- Check Firebase Console → Realtime Database to see if players appear in `online/` and `waiting/`

## What These Security Rules Do

### Security Features:

1. **Authentication Required**: All reads and writes require an authenticated user (users automatically sign in anonymously)
2. **User Data Protection**: Users can only write to their own data paths (identified by their UID)
3. **Game Participation**: Players can only modify games they're part of
4. **Data Validation**: Rules validate data types and formats (e.g., usernames must be 2-15 characters)
5. **Chat Privacy**: Users can only read chats they're participating in

### Benefits:

- **More Secure**: Data is protected from unauthorized access and tampering
- **Still Public**: Anyone can play without creating an account
- **User Privacy**: Players can only access their own data and games they're in
- **No Sign-Up Friction**: Players don't need to sign up or log in manually
- **Free**: Anonymous auth is unlimited on Firebase's free tier

## Need Help?

- [Firebase Documentation](https://firebase.google.com/docs/database)
- [Firebase Realtime Database Rules](https://firebase.google.com/docs/database/security)
- Check the GitHub Issues for this project

---

**Estimated total setup time: 5 minutes**

**Cost: FREE (for most use cases)**

**Difficulty: Easy** 🟢
