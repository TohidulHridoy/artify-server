require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ---------- Database ----------
// The driver connects automatically on the first query, which also works on Vercel.
const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db(process.env.DB_NAME || "artifyDB");
const artworksCollection = db.collection("artworks");
const favoritesCollection = db.collection("favorites");

// ---------- Helpers ----------
const toObjectId = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : null);
const escapeRegex = (text = "") => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hideLikedBy = { projection: { likedBy: 0 } };

// Wraps async routes so any error goes to the error handler instead of crashing
const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const EDITABLE_FIELDS = [
  "imageUrl",
  "title",
  "category",
  "medium",
  "description",
  "dimensions",
  "price",
  "visibility",
];

const pickEditable = (body) => {
  const data = {};
  EDITABLE_FIELDS.forEach((field) => {
    if (body[field] !== undefined) data[field] = body[field];
  });
  if (data.price !== undefined && data.price !== "") data.price = Number(data.price);
  if (data.visibility && !["Public", "Private"].includes(data.visibility)) {
    data.visibility = "Public";
  }
  return data;
};

// ---------- Routes ----------
app.get("/", (req, res) => {
  res.send({ message: "Artify server is running" });
});

// Home: 6 most recent public artworks (sort + limit)
app.get(
  "/featured-artworks",
  asyncRoute(async (req, res) => {
    const result = await artworksCollection
      .find({ visibility: "Public" }, hideLikedBy)
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    res.send(result);
  })
);

// Home: most liked artworks (Community Highlights)
app.get(
  "/popular-artworks",
  asyncRoute(async (req, res) => {
    const result = await artworksCollection
      .find({ visibility: "Public" }, hideLikedBy)
      .sort({ likes: -1, createdAt: -1 })
      .limit(3)
      .toArray();
    res.send(result);
  })
);

// Home: top artists by total likes
app.get(
  "/top-artists",
  asyncRoute(async (req, res) => {
    const result = await artworksCollection
      .aggregate([
        { $match: { visibility: "Public" } },
        {
          $group: {
            _id: "$userEmail",
            name: { $first: "$userName" },
            photo: { $first: "$userPhoto" },
            totalArtworks: { $sum: 1 },
            totalLikes: { $sum: "$likes" },
          },
        },
        { $sort: { totalLikes: -1, totalArtworks: -1 } },
        { $limit: 4 },
      ])
      .toArray();
    res.send(result);
  })
);

// Explore: all public artworks with search (title / artist) and category filter
app.get(
  "/artworks",
  asyncRoute(async (req, res) => {
    const { search = "", category = "" } = req.query;
    const query = { visibility: "Public" };

    if (search.trim()) {
      const pattern = { $regex: escapeRegex(search.trim()), $options: "i" };
      query.$or = [{ title: pattern }, { userName: pattern }];
    }
    if (category && category !== "All") query.category = category;

    const result = await artworksCollection
      .find(query, hideLikedBy)
      .sort({ createdAt: -1 })
      .toArray();
    res.send(result);
  })
);

// Details: one artwork + artist's total artworks + whether this user liked / favorited it
app.get(
  "/artworks/:id",
  asyncRoute(async (req, res) => {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).send({ message: "Invalid artwork id" });

    const artwork = await artworksCollection.findOne({ _id });
    if (!artwork) return res.status(404).send({ message: "Artwork not found" });

    const email = req.query.email;
    const artistTotal = await artworksCollection.countDocuments({
      userEmail: artwork.userEmail,
    });
    const isFavorite = email
      ? !!(await favoritesCollection.findOne({ artworkId: _id, userEmail: email }))
      : false;
    const liked = email ? (artwork.likedBy || []).includes(email) : false;

    const { likedBy, ...rest } = artwork;
    res.send({ ...rest, artistTotal, liked, isFavorite });
  })
);

// Add artwork
app.post(
  "/artworks",
  asyncRoute(async (req, res) => {
    const data = pickEditable(req.body);
    const { userName, userEmail, userPhoto = "" } = req.body;

    const required = ["imageUrl", "title", "category", "medium", "description"];
    const missing = required.filter((field) => !data[field]);
    if (missing.length || !userName || !userEmail) {
      return res
        .status(400)
        .send({ message: `Missing required fields: ${missing.join(", ") || "user info"}` });
    }

    const newArtwork = {
      ...data,
      visibility: data.visibility || "Public",
      userName,
      userEmail,
      userPhoto,
      likes: 0,
      likedBy: [],
      createdAt: new Date(),
    };
    const result = await artworksCollection.insertOne(newArtwork);
    res.status(201).send(result);
  })
);

// Update artwork (only the owner)
app.patch(
  "/artworks/:id",
  asyncRoute(async (req, res) => {
    const _id = toObjectId(req.params.id);
    const { userEmail } = req.body;
    if (!_id || !userEmail) return res.status(400).send({ message: "Invalid request" });

    const result = await artworksCollection.updateOne(
      { _id, userEmail },
      { $set: { ...pickEditable(req.body), updatedAt: new Date() } }
    );
    if (!result.matchedCount) {
      return res.status(403).send({ message: "You can only update your own artwork" });
    }
    res.send(result);
  })
);

// Delete artwork (only the owner) + remove it from everyone's favorites
app.delete(
  "/artworks/:id",
  asyncRoute(async (req, res) => {
    const _id = toObjectId(req.params.id);
    const { email } = req.query;
    if (!_id || !email) return res.status(400).send({ message: "Invalid request" });

    const result = await artworksCollection.deleteOne({ _id, userEmail: email });
    if (!result.deletedCount) {
      return res.status(403).send({ message: "You can only delete your own artwork" });
    }
    await favoritesCollection.deleteMany({ artworkId: _id });
    res.send(result);
  })
);

// Like / unlike using $push, $pull and $inc
app.patch(
  "/artworks/:id/like",
  asyncRoute(async (req, res) => {
    const _id = toObjectId(req.params.id);
    const { email } = req.body;
    if (!_id || !email) return res.status(400).send({ message: "Invalid request" });

    // Try to like: only matches if this user has not liked yet
    const likeResult = await artworksCollection.updateOne(
      { _id, likedBy: { $ne: email } },
      { $push: { likedBy: email }, $inc: { likes: 1 } }
    );

    let liked = true;
    if (!likeResult.modifiedCount) {
      // Already liked, so unlike
      const unlikeResult = await artworksCollection.updateOne(
        { _id, likedBy: email },
        { $pull: { likedBy: email }, $inc: { likes: -1 } }
      );
      if (!unlikeResult.matchedCount) {
        return res.status(404).send({ message: "Artwork not found" });
      }
      liked = false;
    }

    const artwork = await artworksCollection.findOne({ _id }, { projection: { likes: 1 } });
    res.send({ likes: artwork.likes, liked });
  })
);

// My Gallery: artworks added by a user (public and private)
app.get(
  "/my-artworks",
  asyncRoute(async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).send({ message: "Email is required" });
    const result = await artworksCollection
      .find({ userEmail: email }, hideLikedBy)
      .sort({ createdAt: -1 })
      .toArray();
    res.send(result);
  })
);

// Artist profile (optional feature)
app.get(
  "/artists/:email",
  asyncRoute(async (req, res) => {
    const email = req.params.email;
    const artworks = await artworksCollection
      .find({ userEmail: email, visibility: "Public" }, hideLikedBy)
      .sort({ createdAt: -1 })
      .toArray();
    const totalArtworks = await artworksCollection.countDocuments({ userEmail: email });
    if (!totalArtworks) return res.status(404).send({ message: "Artist not found" });

    const first = artworks[0] || (await artworksCollection.findOne({ userEmail: email }));
    const totalLikes = artworks.reduce((sum, art) => sum + (art.likes || 0), 0);
    res.send({
      name: first.userName,
      photo: first.userPhoto,
      email,
      totalArtworks,
      totalLikes,
      artworks,
    });
  })
);

// Favorites: list with fresh artwork data
app.get(
  "/favorites",
  asyncRoute(async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).send({ message: "Email is required" });

    const result = await favoritesCollection
      .aggregate([
        { $match: { userEmail: email } },
        { $sort: { addedAt: -1 } },
        {
          $lookup: {
            from: "artworks",
            localField: "artworkId",
            foreignField: "_id",
            as: "artwork",
          },
        },
        { $unwind: "$artwork" },
        { $project: { "artwork.likedBy": 0 } },
      ])
      .toArray();
    res.send(result);
  })
);

app.post(
  "/favorites",
  asyncRoute(async (req, res) => {
    const artworkId = toObjectId(req.body.artworkId);
    const { userEmail } = req.body;
    if (!artworkId || !userEmail) return res.status(400).send({ message: "Invalid request" });

    const exists = await favoritesCollection.findOne({ artworkId, userEmail });
    if (exists) return res.status(409).send({ message: "Already in your favorites" });

    const artwork = await artworksCollection.findOne({ _id: artworkId });
    if (!artwork) return res.status(404).send({ message: "Artwork not found" });

    const result = await favoritesCollection.insertOne({
      artworkId,
      userEmail,
      addedAt: new Date(),
    });
    res.status(201).send(result);
  })
);

// Unfavorite by artwork id
app.delete(
  "/favorites/:artworkId",
  asyncRoute(async (req, res) => {
    const artworkId = toObjectId(req.params.artworkId);
    const { email } = req.query;
    if (!artworkId || !email) return res.status(400).send({ message: "Invalid request" });

    const result = await favoritesCollection.deleteOne({ artworkId, userEmail: email });
    res.send(result);
  })
);

// ---------- Errors ----------
app.use((req, res) => res.status(404).send({ message: "Route not found" }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send({ message: "Something went wrong on the server" });
});

// Local development only; on Vercel the exported app is used
if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`Artify server running on port ${port}`));
}

module.exports = app;
