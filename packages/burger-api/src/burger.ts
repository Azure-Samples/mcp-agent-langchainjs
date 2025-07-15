export interface Burger {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  toppings: string[]; // IDs of default toppings
}
