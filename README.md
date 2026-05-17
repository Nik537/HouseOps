# HouseOps

Mobilni skupni koledar opravil za štiri cimre.

## Features

- 20 začetnih opravil za kuhinjo, kopalnico, smeti, pralnico, predsobo in dnevno sobo.
- Ob prijavi izbereš profil: Nik, Lucia, Gaj ali Kaja.
- Profil lahko kasneje zamenjaš v aplikaciji.
- Vsaka oseba lahko vidi vsa opravila in jih oceni zase.
- Dodajanje in brisanje opravil.
- Označevanje opravila kot končano.
- Prestavljanje opravila med osebami.
- Tedenski koledar.
- Brskalniška obvestila za opomnike in test obvestil.
- Firebase Realtime Database sync, z lokalnim fallbackom za razvoj.
- Firebase Hosting-ready Vite build.

## Lokalni razvoj

```bash
npm install
npm run dev
```

## Firebase nastavitev

Kopiraj `.env.example` v `.env.local` in dodaj Firebase web app config.

```bash
npm run build
firebase deploy --only database,hosting
```
