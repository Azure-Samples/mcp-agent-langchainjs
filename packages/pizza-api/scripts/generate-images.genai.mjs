// This script uses GenAIScript (https://aka.ms/genaiscript)
// to generate the images for the menu. Be warned that this script can be quite
// long to run, as it will generate about 40 images.
// 
// Note that you need to set GENAISCRIPT_IMAGE_MODEL env variable to either
// "openai:dall-e-3" or "azure:dall-e-3" to run this script.

import pizzasData from '../data/pizzas.json' with { type: "json" };
import toppingsData from '../data/toppings.json' with { type: "json" };
import sharp from 'sharp';

const toppingsMap = new Map(
  toppingsData.map((topping) => [topping.id, topping.name]),
);

const role = `## Role
You're an expert prompt engineer with a deep understanding of Dall-E 3 capabilities and a renowned food photographer. You have a passion for creating visually stunning images that capture the essence of food and culinary art. You know how to create prompts that generate high-quality and realistic pictures with rich details of food and ingredients.`;

// ----------------------------------------------------------------------------
// Generate pizza images

for (const pizza of pizzasData) {
  const { id, name, description } = pizza;
  const toppings = pizza.toppings.map((id) => toppingsMap[id]);
  const imageUrl = `pizza-pic-${id}.jpg`;
  const imagePath = `data/images/${imageUrl}`;
  pizza.imageUrl = imageUrl;

  // Skip if the image already exists
  const exists = await workspace.stat(imagePath);
  if (exists) continue;

  const { text: pizzaPrompt } = await runPrompt((_) => {
    _.$`${role}
  
  ## Task
  You have to create a prompt for Dall-E 3 to generate a realistic photograph of the pizza specified below, as if it was taken by a professional food photographer to illustrate a restaurant menu.
  
  ## Pizza
  - Name: ${name}
  - Description: ${description}
  - Toppings: ${toppings.join(", ")}

  ## Output
  Write only the prompt for Dall-E 3, without any additional text or explanation.`;
  });

  const { image } = await generateImage(pizzaPrompt, {
    size: "1024x1024",
    style: "natural",
  });

  await sharp(image.filename).resize(512, 512).jpeg({ quality: 60 }).toFile(imagePath);
}

// ----------------------------------------------------------------------------
// Generate toppings images

for (const topping of toppingsData) {
  const { id, name, description } = topping;
  const imageUrl = `topping-pic-${id}.jpg`;
  const imagePath = `data/images/${imageUrl}`;
  topping.imageUrl = imageUrl;

  // Skip if the image already exists
  const exists = await workspace.stat(imagePath);
  if (exists) continue;

  const { text: toppingPrompt } = await runPrompt((_) => {
    _.$`${role}
  
  ## Task
  You have to create a prompt for Dall-E 3 to generate a realistic photograph of the pizza topping specified below, as if it was taken by a professional food photographer to illustrate a restaurant menu. Feature the ingredient alone, not on a pizza.
  
  ## Topping
  - Name: ${name}
  - Description: ${description}

  ## Output
  Write only the prompt for Dall-E 3, without any additional text or explanation.`;
  });

  const { image } = await generateImage(toppingPrompt, {
    size: "1024x1024",
    style: "natural",
  });

  await sharp(image.filename).resize(512, 512).jpeg({ quality: 60 }).toFile(imagePath);
}

// ----------------------------------------------------------------------------
// Save updated files with imageUrls
await workspace.writeText("data/pizzas.json", JSON.stringify(pizzasData, null, 2));
await workspace.writeText("data/toppings.json", JSON.stringify(toppingsData, null, 2));
