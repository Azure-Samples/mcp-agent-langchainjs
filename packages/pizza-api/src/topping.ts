export enum ToppingCategory {
  Vegetable = 'vegetable',
  Meat = 'meat',
  Fish = 'fish',
  Fruit = 'fruit',
  Cheese = 'cheese',
  Herbs = 'herbs',
  Spices = 'spices',
  Sauce = 'sauce',
}

export interface Topping {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: ToppingCategory;
}
