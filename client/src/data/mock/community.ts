export interface CommunityPost {
  id: string;
  author: string;
  avatarUrl: string;
  location: string;
  category: "Trip" | "Activity" | "Tip";
  imageUrl: string;
  title: string;
  body: string;
  likes: number;
  comments: number;
  postedAt: string;
}

const img = (id: string, w = 800) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
const av = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=100&q=80`;

export const mockCommunity: CommunityPost[] = [
  {
    id: "post-1",
    author: "Aarav Mehta",
    avatarUrl: av("1500648767791-00dcc994a43e"),
    location: "Kyoto, Japan",
    category: "Trip",
    imageUrl: img("1493976040374-85c8e12f0c0e"),
    title: "10 days chasing cherry blossoms across Japan",
    body: "Started in Tokyo, ended in Kyoto. The temples at dawn were unreal. Budget worked out to about $1,700 including flights — totally worth it.",
    likes: 342,
    comments: 48,
    postedAt: "2 days ago",
  },
  {
    id: "post-2",
    author: "Sara Fernandes",
    avatarUrl: av("1544005313-94ddf0286df2"),
    location: "Bali, Indonesia",
    category: "Activity",
    imageUrl: img("1537996194471-e657df975ab4"),
    title: "Sunrise trek up Mount Batur — do it!",
    body: "Left at 3am, reached the summit for sunrise above the clouds. Guides were fantastic. Easily the highlight of my Bali trip.",
    likes: 521,
    comments: 73,
    postedAt: "4 days ago",
  },
  {
    id: "post-3",
    author: "Diego Alvarez",
    avatarUrl: av("1506794778202-cad84cf45f1d"),
    location: "Barcelona, Spain",
    category: "Tip",
    imageUrl: img("1583422409516-2895a77efded"),
    title: "Skip the Sagrada queue with this trick",
    body: "Book the first slot at 9am online and enter from the Nativity side. Morning light through the stained glass is magical and crowds are thin.",
    likes: 287,
    comments: 31,
    postedAt: "1 week ago",
  },
  {
    id: "post-4",
    author: "Lena Kowalski",
    avatarUrl: av("1534528741775-53994a69daeb"),
    location: "Cape Town, South Africa",
    category: "Trip",
    imageUrl: img("1580060839134-75a5edca2e99"),
    title: "A week between two oceans",
    body: "Table Mountain, Cape Point, and the winelands of Stellenbosch. South Africa punches way above its price point for value.",
    likes: 198,
    comments: 22,
    postedAt: "1 week ago",
  },
  {
    id: "post-5",
    author: "Rahul Nair",
    avatarUrl: av("1633332755192-727a05c4013d"),
    location: "Rome, Italy",
    category: "Activity",
    imageUrl: img("1552832230-c0197dd311b5"),
    title: "Pasta-making class in Trastevere",
    body: "Spent an evening rolling fresh pasta with a local nonna. Best $80 I spent in Italy — and I still make the carbonara at home.",
    likes: 410,
    comments: 55,
    postedAt: "2 weeks ago",
  },
  {
    id: "post-6",
    author: "Mia Chen",
    avatarUrl: av("1502685104226-ee32379fefbe"),
    location: "Lisbon, Portugal",
    category: "Tip",
    imageUrl: img("1585208798174-6cedd86e019a"),
    title: "Take tram 28, but early",
    body: "The classic yellow tram route hits all the miradouros. Go before 9am to actually get a seat and photos without the crowds.",
    likes: 156,
    comments: 18,
    postedAt: "3 weeks ago",
  },
];
