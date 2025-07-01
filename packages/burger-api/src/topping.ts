export enum ToppingCategory {
  Vegetable = 'vegetable',
  Meat = 'meat',
  Cheese = 'cheese',
  Sauce = 'sauce',
  Bun = 'bun',
  Extras = 'extras',
}

export interface Topping {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: ToppingCategory;
}
