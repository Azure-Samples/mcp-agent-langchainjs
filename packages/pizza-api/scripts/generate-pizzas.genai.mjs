// This script uses GenAIScript (https://aka.ms/genaiscript)
// to generate the menu for a pizza restaurant.
import { z } from "genaiscript/runtime";

const role = `## Role
You're a renowned italian chef with a passion for pizza. You have a deep knowledge of classic Italian cuisine and the taste of american customers.`;

// ----------------------------------------------------------------------------
// Generate pizza menu

export const pizzaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  imageUrl: z.string(),
  toppings: z.array(z.string()),
});
export const pizzaMenuSchema = z.array(pizzaSchema);

const { text: pizzas } = await runPrompt((_) => {
  const schema = _.defSchema("SCHEMA", pizzaMenuSchema);
  _.$`${role}

## Task
You have to create a selection of 16 pizzas for a pizza restaurant. The menu should include a variety of flavors and styles, including classic Italian pizzas, American-style pizzas, and unique specialty pizzas. Each pizza should have a name, description, and a list of toppings. The menu must include options for vegetarian, vegan and gluten-free pizzas.

## Output
The output should be an array of JSON objects that conforms to the following schema:
${schema}

ImageUrl should be an empty string for now, as the images will be added later.
`;
});

// ----------------------------------------------------------------------------
// Generate toppings

export const toppingSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  imageUrl: z.string(),
  category: z.enum([
    "vegetable",
    "meat",
    "fish",
    "fruit",
    "cheese",
    "herbs",
    "spices",
    "sauce",
  ]),
});
export const toppingMenuSchema = z.array(toppingSchema);
const { text: toppings } = await runPrompt((_) => {
  const pizzaMenu = def("PIZZAS", pizzas, { language: "json" });
  const schema = _.defSchema("SCHEMA", toppingMenuSchema);
  _.$`${role}

## Task
You have to create a selection of toppings for a pizza restaurant. The toppings must include all the one already used in the ${pizzaMenu}, as well as a few extra ones to cover all the categories if needed.

## Output
The output should be an array of JSON objects that conforms to the following schema:
${schema}

ImageUrl should be an empty string for now, as the images will be added later.
`;
});

// ----------------------------------------------------------------------------
// Replace toppings with their IDs in pizzas

const { text: finalPizzas } = await runPrompt((_) => {
  const pizzaMenu = _.def("PIZZAS", pizzas, { language: "json" });
  const toppingMenu = _.def("TOPPINGS", toppings, { language: "json" });
  const schema = _.defSchema("SCHEMA", pizzaMenuSchema);
  _.$`${role}

## Task
For each pizza in the ${pizzaMenu}, replace the toppings with their IDs from the ${toppingMenu}. The output should be a valid JSON array of pizzas, where each pizza has a list of topping IDs instead of names.

## Output
The output should be an array of JSON objects that conforms to the following schema:
${schema}
`;
});

// ----------------------------------------------------------------------------
// Sanity check

const parsedPizzas = pizzaMenuSchema.parse(JSON.parse(finalPizzas));
const parsedToppings = toppingMenuSchema.parse(JSON.parse(toppings));
const toppingIds = new Set(parsedToppings.map((topping) => topping.id));

for (const pizza of parsedPizzas) {
  // Check that all toppings are valid
  for (const topping of pizza.toppings) {
    if (!toppingIds.has(topping)) {
      throw new Error(`Invalid topping ID ${topping} in pizza ${pizza.name}`);
    }
  }
  // Check that the pizza has at least one topping
  if (pizza.toppings.length === 0) {
    throw new Error(`Pizza ${pizza.name} has no toppings`);
  }
  // Check that the pizza has a valid price
  if (pizza.price <= 0) {
    throw new Error(`Pizza ${pizza.name} has an invalid price`);
  }
}

// ----------------------------------------------------------------------------
// Save files

await workspace.writeText("data/pizzas.json", finalPizzas);
await workspace.writeText("data/toppings.json", toppings);
