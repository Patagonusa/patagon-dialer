# Patagon Dialer - Session Summary (January 15, 2026)

## Project Overview
A lead management and dialing system with React frontend and Express.js backend deployed to Render.

## Services & URLs

### Production (Render)
- **Frontend**: https://patagon-dialer-frontend.onrender.com
- **Backend API**: https://patagon-dialer-api.onrender.com
- **GitHub Repo**: https://github.com/Patagonusa/patagon-dialer

### Custom Domain (patagonphone.com via GoDaddy)
- **Frontend**: https://patagonphone.com (LIVE)
- **WWW**: https://www.patagonphone.com (redirects to apex)
- **API**: https://api.patagonphone.com

### Render Service IDs
- Frontend: `srv-d5k6ikvgi27c739jut00`
- Backend: `srv-d5k6iie3jp1c73eghnn0`

## Credentials
**Note:** All credentials are stored in Render environment variables and local `.env` files (not committed to git).
- Supabase: Check Render dashboard or `backend/.env`
- Twilio: Check Render dashboard or `backend/.env`
- Render API Key: Check local notes

## GoDaddy DNS Configuration (patagonphone.com)
| Type | Name | Value |
|------|------|-------|
| A | @ | 216.24.57.1 |
| CNAME | www | patagon-dialer-frontend.onrender.com |
| CNAME | api | patagon-dialer-api.onrender.com |

## Key Features Implemented This Session

### 1. Call Recording Proxy
- Created `/api/recordings/:recordingSid` endpoint to proxy Twilio recordings
- Avoids Twilio auth popup for users
- Accepts JWT token via query parameter for HTML audio elements
- Location: `backend/server.js`

### 2. Incoming Call Message
- Updated TwiML to say: "Thank you for calling. Please hold while we transfer your call."
- When no agents available: "Thank you for calling. No agents are available at the moment. Please leave a message after the tone."
- Location: `backend/server.js`

### 3. UI Improvements
- Added lead numbers (showing ID, newest first)
- Moved call history below notes section
- Location: `frontend/src/App.jsx`

## Pending Tasks
1. Verify API SSL certificate is issued (api.patagonphone.com)
2. Update frontend to use api.patagonphone.com instead of Render URL (optional)
3. Future: Integrate transcription system with call recordings

## File Structure
```
patagon-dialer/
├── backend/
│   ├── server.js          # Express server with Twilio, Supabase, recording proxy
│   ├── package.json
│   └── .env               # Local env (DO NOT COMMIT)
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main React app with all components
│   │   └── index.css      # Styles
│   ├── package.json
│   └── vite.config.js
└── CONVERSATION_SESSION_20260115.md
```

## Quick Commands

### Local Development
```bash
# Backend
cd patagon-dialer/backend
npm install
npm start

# Frontend
cd patagon-dialer/frontend
npm install
npm run dev
```

### Deploy (auto-deploys on push to main)
```bash
git add .
git commit -m "your message"
git push origin main
```
