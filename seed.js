// Adds sample artworks so the Home and Explore pages are not empty.
// Run once with: npm run seed
require("dotenv").config();
const { MongoClient } = require("mongodb");

const img = (id) => `https://images.unsplash.com/${id}?w=1200&q=80&auto=format&fit=crop`;

const artists = {
  nadia: {
    userName: "Nadia Rahman",
    userEmail: "nadia.rahman@artify.demo",
    userPhoto: "https://i.pravatar.cc/150?img=47",
  },
  arif: {
    userName: "Arif Hossain",
    userEmail: "arif.hossain@artify.demo",
    userPhoto: "https://i.pravatar.cc/150?img=12",
  },
  mira: {
    userName: "Mira Chowdhury",
    userEmail: "mira.chowdhury@artify.demo",
    userPhoto: "https://i.pravatar.cc/150?img=32",
  },
};

const samples = [
  {
    ...artists.nadia,
    title: "Monsoon Over the River",
    category: "Painting",
    medium: "Oil on canvas",
    description:
      "Heavy clouds roll over a quiet river town just before the first rain of the season. Thick palette-knife strokes give the sky its weight.",
    dimensions: "24 x 36 in",
    price: 450,
    imageUrl: img("photo-1579783902614-a3fb3927b6a5"),
    likes: 18,
  },
  {
    ...artists.arif,
    title: "Fragments of Blue",
    category: "Mixed Media",
    medium: "Acrylic, paper collage",
    description:
      "Torn paper, layered acrylic and a single line of gold leaf. A study of how memories break apart and come back together.",
    dimensions: "30 x 30 in",
    price: 320,
    imageUrl: img("photo-1541961017774-22349e4a1262"),
    likes: 25,
  },
  {
    ...artists.mira,
    title: "Carnival of Color",
    category: "Painting",
    medium: "Acrylic on board",
    description:
      "Bright pours of pink, yellow and teal inspired by the Pohela Boishakh fair. Made in one sitting with no brushes at all.",
    dimensions: "20 x 24 in",
    price: 280,
    imageUrl: img("photo-1547891654-e66ed7ebb968"),
    likes: 31,
  },
  {
    ...artists.nadia,
    title: "Quiet Studio Morning",
    category: "Photography",
    medium: "Digital photograph",
    description:
      "Morning light falling across brushes, jars and half-finished canvases in the artist's studio.",
    dimensions: "",
    price: null,
    imageUrl: img("photo-1513364776144-60967b0f800f"),
    likes: 9,
  },
  {
    ...artists.arif,
    title: "Golden Hour Bloom",
    category: "Watercolor",
    medium: "Watercolor on cold-press paper",
    description:
      "Loose washes of ochre and rose that let the paper breathe. Painted on a balcony during the last light of the day.",
    dimensions: "12 x 16 in",
    price: 150,
    imageUrl: img("photo-1578301978693-85fa9c0320b9"),
    likes: 14,
  },
  {
    ...artists.mira,
    title: "Neon Dreamer",
    category: "Digital Art",
    medium: "Procreate, iPad",
    description:
      "A dreamy portrait lit by city signs, drawn entirely on a tablet with custom grain brushes.",
    dimensions: "4000 x 5000 px",
    price: 90,
    imageUrl: img("photo-1549490349-8643362247b5"),
    likes: 22,
  },
  {
    ...artists.nadia,
    title: "Lines of the Old City",
    category: "Sketch & Drawing",
    medium: "Ink and graphite",
    description:
      "Narrow lanes, hanging wires and rickshaws of Old Dhaka captured in fast ink lines on location.",
    dimensions: "11 x 14 in",
    price: 120,
    imageUrl: img("photo-1536924940846-227afb31e2a5"),
    likes: 11,
  },
];

async function seed() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    const collection = client.db(process.env.DB_NAME || "artifyDB").collection("artworks");
    const now = Date.now();
    const docs = samples.map((art, index) => ({
      ...art,
      visibility: "Public",
      likedBy: [],
      createdAt: new Date(now - index * 60 * 60 * 1000), // one hour apart
    }));
    const result = await collection.insertMany(docs);
    console.log(`Inserted ${result.insertedCount} sample artworks`);
  } finally {
    await client.close();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
