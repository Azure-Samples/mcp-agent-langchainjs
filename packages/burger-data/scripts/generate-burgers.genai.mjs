// This script uses GenAIScript (https://aka.ms/genaiscript)
// to generate the menu for a burger restaurant.
/* eslint-disable */

import { z } from '@genaiscript/runtime';

const role = `## Role
You're a renowned chef with a passion for creating amazing burgers. You have a deep knowledge of American cuisine and international flavors that appeal to diverse customers.`;

// ----------------------------------------------------------------------------
// Generate burger menu

export const burgerSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  imageUrl: z.string(),
  toppings: z.array(z.string()),
});
export const burgerMenuSchema = z.array(burgerSchema);

const { text: burgers } = await runPrompt((_) => {
  const schema = _.defSchema('SCHEMA', burgerMenuSchema);
  _.$`${role}

## Task
You have to create a selection of 10 burgers for a burger restaurant. The menu should include a variety of flavors and styles, including classic American burgers, gourmet specialty burgers, and international fusion burgers. Each burger should have a name, description, and a list of toppings. The menu must include options for vegetarian, vegan and gluten-free burgers.

## Output
The output should be an array of JSON objects that conforms to the following schema:
${schema}

Use simple, incremental ID numbers starting from 1 for each burger.
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
  category: z.enum(['vegetable', 'meat', 'cheese', 'sauce', 'bun', 'extras']),
});
export const toppingMenuSchema = z.array(toppingSchema);
const { text: toppings } = await runPrompt((_) => {
  const burgerMenu = def('BURGERS', burgers, { language: 'json' });
  const schema = _.defSchema('SCHEMA', toppingMenuSchema);
  _.$`${role}

## Task
You have to create a selection of toppings for a burger restaurant. The toppings must include all the ones already used in the ${burgerMenu}, as well as a few extra ones to cover all the categories if needed. Bun are not considered toppings, but rather part of the burger itself.

## Output
The output should be an array of JSON objects that conforms to the following schema:
${schema}

Use simple, incremental ID numbers starting from 1 for each topping.
ImageUrl should be an empty string for now, as the images will be added later.
`;
});

// ----------------------------------------------------------------------------
// Replace toppings with their IDs in burgers

const { text: finalBurgers } = await runPrompt((_) => {
  const burgerMenu = _.def('BURGERS', burgers, { language: 'json' });
  const toppingMenu = _.def('TOPPINGS', toppings, { language: 'json' });
  const schema = _.defSchema('SCHEMA', burgerMenuSchema);
  _.$`${role}

## Task
For each burger in the ${burgerMenu}, replace the toppings with their IDs from the ${toppingMenu}. The output should be a valid JSON array of burgers, where each burger has a list of topping IDs instead of names.

## Output
The output should be an array of JSON objects that conforms to the following schema:
${schema}
`;
});

// ----------------------------------------------------------------------------
// Sanity check

const parsedBurgers = burgerMenuSchema.parse(JSON.parse(finalBurgers));
const parsedToppings = toppingMenuSchema.parse(JSON.parse(toppings));
const toppingIds = new Set(parsedToppings.map((topping) => topping.id));

for (const burger of parsedBurgers) {
  // Check that all toppings are valid
  for (const topping of burger.toppings) {
    if (!toppingIds.has(topping)) {
      throw new Error(`Invalid topping ID ${topping} in burger ${burger.name}`);
    }
  }

  // Check that the burger has at least one topping
  if (burger.toppings.length === 0) {
    throw new Error(`Burger ${burger.name} has no toppings`);
  }

  // Check that the burger has a valid price
  if (burger.price <= 0) {
    throw new Error(`Burger ${burger.name} has an invalid price`);
  }
}

// ----------------------------------------------------------------------------
// Save files

await workspace.writeText('data/burgers.json', finalBurgers);
await workspace.writeText('data/toppings.json', toppings);
