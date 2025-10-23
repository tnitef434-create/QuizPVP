# Firebase Setup Guide for QuizPVP

This guide will help you set up your own Firebase backend for QuizPVP in **less than 5 minutes**. Firebase is completely FREE for this use case!

## Why Do I Need This?

The demo Firebase config in the code is for testing only. To deploy your game for real players, you need your own Firebase project.

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
3. Choose location closest to your players (e.g., `us-central1`)
4. Start in **"Test mode"** for now
5. Click **"Enable"**

### 3. Set Database Rules (30 seconds)

1. Click the **"Rules"** tab in your Realtime Database
2. Replace the rules with this:

```json
{
  "rules": {
    "online": {
      ".read": true,
      ".write": true,
      ".indexOn": ["timestamp"]
    },
    "waiting": {
      ".read": true,
      ".write": true,
      ".indexOn": ["timestamp"]
    },
    "games": {
      ".read": true,
      ".write": true,
      ".indexOn": ["createdAt"]
    }
  }
}
```

3. Click **"Publish"**

⚠️ **Note**: These rules allow anyone to read/write. This is fine for a game like this, but for production apps with sensitive data, you'd want more restrictive rules.

### 4. Get Your Config (1 minute)

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

### 5. Update Your Code (30 seconds)

1. Open `client.js` in your QuizPVP folder
2. Find the `firebaseConfig` section (lines 15-24)
3. Replace the demo config with YOUR config from step 4
4. Save the file

That's it! Your game is now connected to your own Firebase backend! 🎉

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

## Security Best Practices (Optional)

For a public game, the simple rules work fine. But if you want to add security:

```json
{
  "rules": {
    "online": {
      ".read": true,
      "$playerId": {
        ".write": "$playerId === auth.uid || !data.exists()"
      }
    },
    "waiting": {
      ".read": true,
      "$playerId": {
        ".write": "$playerId === auth.uid || !data.exists()"
      }
    },
    "games": {
      ".read": true,
      "$gameId": {
        ".write": "!data.exists() || (data.child('player1/id').val() === auth.uid || data.child('player2/id').val() === auth.uid)"
      }
    }
  }
}
```

This requires Firebase Authentication, which adds complexity but prevents abuse.

## Need Help?

- [Firebase Documentation](https://firebase.google.com/docs/database)
- [Firebase Realtime Database Rules](https://firebase.google.com/docs/database/security)
- Check the GitHub Issues for this project

---

**Estimated total setup time: 5 minutes**

**Cost: FREE (for most use cases)**

**Difficulty: Easy** 🟢
