export interface LaundryService {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  estimatedTime?: string;
  popular?: boolean;
  unit: "KG" | "PC" | "SET";
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
}

export const laundryServices: LaundryService[] = [
  // Laundry Services
  {
    id: "laundry-fold",
    name: "Laundry and Fold",
    description: "Basic washing and folding service for everyday clothes.",
    price: 70,
    unit: "KG",
    category: "laundry",
    estimatedTime: "24-48 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F6b3c2663d3f1453b8e3aca8210aa20e8?format=webp&width=800",

    popular: true,
  },
    {
    id: "laundry-iron",
    name: "Laundry and Iron",
    description:
      "Complete washing and ironing service for fresh, crisp clothes.",
    price: 120,
    unit: "KG",
    category: "laundry",
    estimatedTime: "24-48 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F3ed634e80c4f4cd793d62c1354de966f%2Fe8e7c3bcefaf40448da183ce942f6bc1?format=webp&width=800",

    popular: true,
  },

  // Iron Services
    {
    id: "regular-iron",
    name: "Regular Iron",
    description: "All clothing items - basic ironing service.",
    price: 20,
    unit: "PC",
    category: "iron",
    estimatedTime: "24 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F4566c495ee9f41b59d0bc341b7b430ae?format=webp&width=800",
  },
      {
    id: "steam-press-suit",
    name: "Men's Suit / Lehenga / Heavy Dresses",
    description: "Professional steam pressing for men's suits, lehengas, and heavy dresses.",
    price: 150,
    unit: "SET",
    category: "iron",
    estimatedTime: "24-48 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F3ed634e80c4f4cd793d62c1354de966f%2Fcc2c175e90d74b4cac7f761ced5e7f7b?format=webp&width=800",
  },
      {
    id: "steam-press-ladies-suit",
    name: "Ladies Suit / Kurta & Pyjama / Saree",
    description: "Expert steam pressing for ladies suits, kurta sets, and sarees.",
    price: 100,
    unit: "SET",
    category: "iron",
    estimatedTime: "24 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F3ed634e80c4f4cd793d62c1354de966f%2F16b932c5fca14b4494b37f55e477584d?format=webp&width=800",
  },
      {
    id: "steam-press-regular",
    name: "Regular Items",
    description: "Steam pressing for standard clothing items.",
    price: 40,
    unit: "PC",
    category: "iron",
    estimatedTime: "24 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2Ff93ebf096d1e43529c8a1e3625dea9da?format=webp&width=800",
  },

  // Men's Dry Clean
  {
    id: "dry-clean-mens-shirt",
    name: "Men's Shirt/T-Shirt",
    description: "Professional dry cleaning for men's shirts and t-shirts.",
    price: 100,
    unit: "PC",
    category: "mens-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F7fe434e371224e84a53ea5b6f3a2191e?format=webp&width=800",
  },
  {
    id: "dry-clean-mens-trouser",
    name: "Trouser/Jeans",
    description: "Expert dry cleaning for men's trousers and jeans.",
    price: 120,
    unit: "PC",
    category: "mens-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F50ebbc6d69b0454bada929bd0fcbafdc%2F22d2132feed74fe9b81d9566f08e2558?format=webp&width=800",
  },
  {
    id: "dry-clean-mens-coat",
    name: "Coat",
    description: "Premium dry cleaning for men's coats and blazers.",
    price: 240,
    unit: "PC",
    category: "mens-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F81690113445d43dd96096a2035c2321a?format=webp&width=800",
  },
  {
    id: "dry-clean-mens-suit-2pc",
    name: "Men's Suit 2 PC",
    description: "Complete dry cleaning service for 2-piece men's suits.",
    price: 360,
    unit: "SET",
    category: "mens-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F9862930473254d15aa4f75f96c5eb95c?format=webp&width=800",
  },
  {
    id: "dry-clean-mens-suit-3pc",
    name: "Men's Suit 3 PC",
    description: "Complete dry cleaning service for 3-piece men's suits.",
    price: 540,
    unit: "SET",
    category: "mens-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2Fe917c541f27242dd87d3aad5496d52a1?format=webp&width=800",
  },
  {
    id: "dry-clean-kurta-pyjama",
    name: "Kurta Pyjama (2 PC)",
    description: "Traditional dry cleaning for kurta pyjama sets.",
    price: 220,
    unit: "SET",
    category: "mens-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2Fe2cd35058c474d539527c1c79ae91bcd?format=webp&width=800",
  },
    {
    id: "dry-clean-achkan-sherwani",
    name: "Achkan / Sherwani",
    description: "Premium dry cleaning for traditional formal wear.",
    price: 300,
    unit: "SET",
    category: "mens-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F073f84434da746a49ef6185f9a6115fe?format=webp&width=800",
  },
    {
    id: "dry-clean-mens-kurta",
    name: "Kurta",
    description: "Professional dry cleaning for men's kurtas.",
    price: 120,
    unit: "PC",
    category: "mens-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F3ed634e80c4f4cd793d62c1354de966f%2F751e8f21a94f4fbb9dd0c820dd7eabf3?format=webp&width=800",
  },

  // Women's Dry Clean
      {
    id: "dry-clean-womens-kurta-kurti",
    name: "Kurta / Kurti",
    description: "Professional dry cleaning for women's kurtas and kurtis.",
    price: 120,
    unit: "PC",
    category: "womens-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F3ed634e80c4f4cd793d62c1354de966f%2F581217e0f5cf47f68d3c0c898a2eae65?format=webp&width=800",
  },
  {
    id: "dry-clean-salwar-plazo",
    name: "Salwar/Plazo/Dupatta",
    description: "Expert dry cleaning for salwar, plazo, and dupatta.",
    price: 120,
    unit: "PC",
    category: "womens-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2Fd03681910e5141bb81c10fda58a2f990?format=webp&width=800",
  },
  {
    id: "dry-clean-saree-simple",
    name: "Saree Simple/Silk",
    description: "Careful dry cleaning for simple and silk sarees.",
    price: 240,
    unit: "PC",
    category: "womens-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2Fdba4a2f0f3634bac925b88aade98dba7?format=webp&width=800",
  },
  {
    id: "dry-clean-saree-heavy",
    name: "Saree (Heavy Work)",
    description: "Specialized dry cleaning for heavily embroidered sarees.",
    price: 300,
    unit: "PC",
    category: "womens-dry-clean",
    estimatedTime: "72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F244ad171191f4fbcb5358b80ceaa36aa?format=webp&width=800",
  },
  {
    id: "dry-clean-blouse",
    name: "Blouse",
    description: "Delicate dry cleaning for blouses and tops.",
    price: 90,
    unit: "PC",
    category: "womens-dry-clean",
    estimatedTime: "48 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F25d4228f5ce14a258f3a9d44d3b5703f%2Fe90503b0844246d8a14bfff798ba45ec?format=webp&width=800",
  },
  {
    id: "dry-clean-dress",
    name: "Dress",
    description: "Professional dry cleaning for women's dresses.",
    price: 240,
    unit: "PC",
    category: "womens-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F073a7926109945f9b92aa38135745e58?format=webp&width=800",
  },
  {
    id: "dry-clean-top",
    name: "Top",
    description: "Quality dry cleaning for women's tops and blouses.",
    price: 140,
    unit: "PC",
    category: "womens-dry-clean",
    estimatedTime: "48 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F25d4228f5ce14a258f3a9d44d3b5703f%2F4c74c4136c6448e0a35d0787dadb7f10?format=webp&width=800",
  },
  {
    id: "dry-clean-skirt-heavy",
    name: "Skirt (Heavy Work)",
    description: "Specialized cleaning for heavily embroidered skirts.",
    price: 180,
    unit: "PC",
    category: "womens-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F65ea10a2e5c14ebf9534062314fbbdf2?format=webp&width=800",
  },
  {
    id: "dry-clean-lehenga-1pc",
    name: "Lehenga 1 PC",
    description: "Expert dry cleaning for single-piece lehengas.",
    price: 400,
    unit: "PC",
    category: "womens-dry-clean",
    estimatedTime: "72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F65ea10a2e5c14ebf9534062314fbbdf2?format=webp&width=800",
  },
  {
    id: "dry-clean-lehenga-2pc",
    name: "Lehenga 2+ PC",
    description: "Complete dry cleaning for multi-piece lehenga sets.",
    price: 600,
    unit: "SET",
    category: "womens-dry-clean",
    estimatedTime: "72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2Fdfaab297b9f14eb49f30d294fab5765a?format=webp&width=800",
  },
  {
    id: "dry-clean-lehenga-heavy",
    name: "Lehenga Heavy",
    description: "Premium cleaning for heavily embroidered lehengas.",
    price: 700,
    unit: "SET",
    category: "womens-dry-clean",
    estimatedTime: "72-96 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2Fc6f8193b331d4fd182faf379bea4644b?format=webp&width=800",
  },
    {
    id: "dry-clean-lehenga-bridal-luxury",
    name: "Lehenga Bridal / Luxury",
    description: "Premium cleaning service for bridal and luxury lehengas.",
    price: 1000,
    unit: "SET",
    category: "womens-dry-clean",
    estimatedTime: "96 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F4c9284cb2386421c877de620c984ee10?format=webp&width=800",
  },

  // Woolen Dry Clean
  {
    id: "dry-clean-jacket",
    name: "Jacket F/H Sleeves",
    description: "Professional dry cleaning for full and half sleeve jackets.",
    price: 240,
    unit: "PC",
    category: "woolen-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F50ce6c1ac379418c947c17c24ccab90c?format=webp&width=800",
  },
  {
    id: "dry-clean-sweater",
    name: "Sweater / Sweat Shirt",
    description: "Gentle dry cleaning for sweaters and sweatshirts.",
    price: 180,
    unit: "PC",
    category: "woolen-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F0eacdeab65264e0fa3186728a9e3c436?format=webp&width=800",
  },
  {
    id: "dry-clean-long-coat",
    name: "Long Coat",
    description: "Expert cleaning for long coats and overcoats.",
    price: 300,
    unit: "PC",
    category: "woolen-dry-clean",
    estimatedTime: "72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F3a5480ed186e482dbc6e1adb3253c827?format=webp&width=800",
  },
  {
    id: "dry-clean-shawl",
    name: "Shawl",
    description: "Delicate cleaning for woolen and silk shawls.",
    price: 180,
    unit: "PC",
    category: "woolen-dry-clean",
    estimatedTime: "48-72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F70bdfc9146d345c683c2cbe94657643d?format=webp&width=800",
  },
  {
    id: "dry-clean-pashmina",
    name: "Pashmina",
    description: "Luxury cleaning for premium pashmina shawls.",
    price: 300,
    unit: "PC",
    category: "woolen-dry-clean",
    estimatedTime: "72 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2F53749104ab8c4c869d6d2cc00eb0707b?format=webp&width=800",
  },
  {
    id: "dry-clean-leather-jacket",
    name: "Leather Jacket",
    description: "Specialized cleaning for leather jackets and coats.",
    price: 480,
    unit: "PC",
    category: "woolen-dry-clean",
    estimatedTime: "72-96 hours",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2Fc97d5a75b4604b65bd2bd6fccd499b08%2Fe8317bf58a5a44548b41ef6110314859?format=webp&width=800",
  },
];

export const serviceCategories = [
  { id: "all", name: "All Services", icon: "🧺" },
  { id: "laundry", name: "Laundry", icon: "🫧" },
  { id: "iron", name: "Iron", icon: "🔥" },
  { id: "mens-dry-clean", name: "Men's Dry Clean", icon: "👔" },
  { id: "womens-dry-clean", name: "Women's Dry Clean", icon: "👗" },
  { id: "woolen-dry-clean", name: "Woolen Dry Clean", icon: "🧥" },
];

// Utility functions
export const getPopularServices = (): LaundryService[] => {
  return laundryServices.filter((service) => service.popular);
};

export const getSortedServices = (
  sortBy: "price" | "name" | "category" = "category",
): LaundryService[] => {
  const sorted = [...laundryServices];

  switch (sortBy) {
    case "price":
      return sorted.sort((a, b) => a.price - b.price);
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "category":
    default:
      return sorted.sort((a, b) => a.category.localeCompare(b.category));
  }
};

export const getServiceById = (id: string): LaundryService | undefined => {
  return laundryServices.find((service) => service.id === id);
};

export const getServicesByCategory = (category: string): LaundryService[] => {
  if (category === "all") return laundryServices;
  return laundryServices.filter((service) => service.category === category);
};

export const searchServices = (query: string): LaundryService[] => {
  if (!query.trim()) return laundryServices;

  const lowercaseQuery = query.toLowerCase();
  return laundryServices.filter(
    (service) =>
      service.name.toLowerCase().includes(lowercaseQuery) ||
      service.description.toLowerCase().includes(lowercaseQuery) ||
      service.category.toLowerCase().includes(lowercaseQuery),
  );
};

export const getCategoryDisplay = (categoryId: string): string => {
  const category = serviceCategories.find((cat) => cat.id === categoryId);
  return category ? `${category.icon} ${category.name}` : categoryId;
};
