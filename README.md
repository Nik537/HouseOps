# HouseOps

Mobile-first shared chore calendar for a four-person apartment.

## Features

- 20 starter chores across kitchen, bathroom, bins, laundry, hallway, and living room.
- Add and delete chores from the app.
- Mark chores done.
- Reassign chores between four roommates.
- Vote on chore preference with Love, Like, Neutral, Dislike, and Hard no.
- Week calendar view.
- Firebase Realtime Database sync when configured, with local browser fallback for development.
- Firebase Hosting-ready Vite build.

## Local development

```bash
npm install
npm run dev
```

## Firebase setup

Copy `.env.example` to `.env.local` and fill it with the Firebase web app config.

```bash
npm run build
firebase deploy --only database,hosting
```
