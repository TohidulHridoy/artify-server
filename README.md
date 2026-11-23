# Artify Server

Express + MongoDB REST API for **Artify**, a creative artwork showcase platform.

## Setup

```bash
npm install
cp .env.example .env     # add your MongoDB Atlas URI
npm run seed             # optional: add sample artworks
npm run dev              # http://localhost:5000
```

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/featured-artworks` | 6 newest public artworks (`sort()` + `limit()`) |
| GET | `/popular-artworks` | 3 most liked artworks |
| GET | `/top-artists` | Top 4 artists by total likes (aggregation) |
| GET | `/artworks?search=&category=` | Public artworks, search by title/artist, filter by category |
| GET | `/artworks/:id?email=` | One artwork + artist total + liked / favorite status |
| POST | `/artworks` | Add artwork |
| PATCH | `/artworks/:id` | Update artwork (owner only, `userEmail` in body) |
| DELETE | `/artworks/:id?email=` | Delete artwork (owner only) |
| PATCH | `/artworks/:id/like` | Like / unlike with `$push`, `$pull`, `$inc` |
| GET | `/my-artworks?email=` | A user's own artworks |
| GET | `/artists/:email` | Artist profile |
| GET | `/favorites?email=` | A user's favorites (`$lookup` for fresh data) |
| POST | `/favorites` | Add to favorites |
| DELETE | `/favorites/:artworkId?email=` | Remove from favorites |

## Deploy (Vercel)

1. Push this folder to its own GitHub repo.
2. Import it on Vercel and add `MONGODB_URI` and `DB_NAME` as environment variables.
3. In MongoDB Atlas → Network Access, allow `0.0.0.0/0` so Vercel can connect.
