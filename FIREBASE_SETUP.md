# Firebase Setup for QuizPVP

## ⚠️ IMPORTANT: Apply These Rules to Firebase

Your Firebase Realtime Database needs these rules to work properly.

## How to Apply Rules

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **quizpvp-5a2e2**
3. Click **Realtime Database** in the left menu
4. Click the **Rules** tab
5. **DELETE ALL EXISTING RULES**
6. **COPY AND PASTE** the rules below
7. Click **Publish**

## ✅ WORKING FIREBASE RULES (Copy Everything Below)

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

## That's It!

These simple rules allow your game to work perfectly. They give:
- ✅ Full read access to all players
- ✅ Full write access to all players
- ✅ Works with Math games (1v1, 1v2, 1v3)
- ✅ Works with Rock Paper Scissors (1v1, 1v2, 1v3)
- ✅ Works with Chat system
- ✅ Works with Friends system

## Database Structure

Your Firebase will automatically create these nodes:

### Math Games
- `games/` - Active 1v1 math games
- `games_trios/` - Active 3-player math games
- `games_squad/` - Active 4-player math games
- `waiting_1v1/` - Players waiting for 1v1 match
- `waiting_trios/` - Players waiting for 1v2 match
- `waiting_squad/` - Players waiting for 1v3 match

### Rock Paper Scissors Games
- `games_rps/` - All active RPS games (1v1, 1v2, 1v3)
- `waiting_rps1v1/` - Players waiting for RPS 1v1
- `waiting_rps1v2/` - Players waiting for RPS 1v2
- `waiting_rps1v3/` - Players waiting for RPS 1v3

### Social Features
- `chats/` - Active chat sessions
- `waiting_chat/` - Players waiting for chat partner
- `friends/` - Friend lists
- `friendRequests/` - Pending friend requests
- `gameInvites/` - Game invitations

### System
- `online/` - Currently online players
- `usernames/` - Registered usernames

## Troubleshooting

### If Firebase is not connecting:

1. **Check Rules Are Applied:**
   - Go to Firebase Console → Realtime Database → Rules
   - Make sure the rules match exactly what's shown above
   - Click "Publish" if you made changes

2. **Check Database is Enabled:**
   - Go to Firebase Console → Realtime Database
   - Make sure database exists and is not in "locked mode"
   - If locked, change rules to the ones above

3. **Test Connection:**
   - Open your game in browser
   - Press F12 to open console
   - Look for: `✅ Connected to Firebase!`
   - If you see `⚠️ Not connected to Firebase`, check rules again

## Security Note

These rules are **PUBLIC** which means:
- ✅ Perfect for development and testing
- ✅ Perfect for small games with friends
- ⚠️ Anyone can read/write to your database

For production with many users, you'll want to add authentication later. But for now, these rules work perfectly!
