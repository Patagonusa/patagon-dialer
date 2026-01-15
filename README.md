# Patagon Dialer

Lead Management and Dialer System with SMS capabilities.

## Features

- **Lead Management**: Upload Excel files with customer data
- **Lead Cards**: View and manage customer information
- **SMS Conversations**: Text customers directly from the interface (via Twilio)
- **Dispositions**: Track call outcomes
- **Appointments**: Schedule and manage appointments
- **Dispatch**: Send appointment details to salespeople via SMS

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **SMS**: Twilio
- **Hosting**: Render

## Setup

### 1. Database Setup (Supabase)

1. Go to your Supabase project
2. Navigate to SQL Editor
3. Run the SQL from `database/schema.sql`

### 2. Local Development

```bash
# Install dependencies
npm run install:all

# Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials

# Run development servers
npm run dev
```

### 3. Deploy to Render

1. Push code to GitHub
2. Connect Render to GitHub repository
3. Use the Blueprint (render.yaml) or manually create:
   - Web Service for API (backend)
   - Static Site for Frontend
4. Set environment variables in Render dashboard

### Environment Variables (Backend)

| Variable | Description |
|----------|-------------|
| SUPABASE_URL | Your Supabase project URL |
| SUPABASE_KEY | Supabase anon/public key |
| TWILIO_SID | Twilio Account SID |
| TWILIO_AUTH_TOKEN | Twilio Auth Token |
| TWILIO_PHONE | Your Twilio phone number |

### Environment Variables (Frontend)

| Variable | Description |
|----------|-------------|
| VITE_API_URL | Backend API URL |

## Excel File Format

Upload Excel files with these columns:

| Column | Description |
|--------|-------------|
| Name | Customer full name |
| Address | Street address |
| City | City |
| State | State |
| Zip | Zip code |
| Phone | Primary phone |
| Phone 2 | Secondary phone (optional) |
| Phone 3 | Tertiary phone (optional) |
| Job Group | Job title/category |
| Date | Lead date |
| Source | Lead source |

## Twilio Webhook (Incoming SMS)

Configure your Twilio number's webhook to:
`https://your-api-url.onrender.com/api/webhook/sms`
