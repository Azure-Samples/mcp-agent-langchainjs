// This script uses GenAIScript (https://aka.ms/genaiscript)
// to generate a beer catalog for Contoso World Beers.

import { z } from '@genaiscript/runtime';

const role = `## Role
You're a world-renowned brewmaster and beer sommelier with deep expertise in craft beers, international beer styles, and food pairing. You work for Contoso World Beers, a premium beer company.`;

// ----------------------------------------------------------------------------
// Generate beer catalog

const beerSchema = z.object({
  id: z.string(),
  name: z.string(),
  style: z.string(),
  brewery: z.string(),
  abv: z.number(),
  description: z.string(),
  flavorNotes: z.array(z.string()),
  pairingNotes: z.array(z.string()),
});
const beerCatalogSchema = z.array(beerSchema);

const { text: beers } = await runPrompt((_) => {
  const schema = _.defSchema('SCHEMA', beerCatalogSchema);
  _.$`${role}

## Task
Create a diverse catalog of 1000 beers for Contoso World Beers. The catalog should include:
- A wide variety of styles: Lagers, IPAs, Stouts, Porters, Wheat beers, Pilsners, Belgian ales, Sours, Pale Ales, Amber Ales, Brown Ales, Red Ales, Saisons, Barleywines, and more
- Both well-known classic styles and creative craft variations
- A range of ABV levels from non-alcoholic beers (0%), light session beers (3-4%) to strong ales (8-12%) and more extreme styles (15%+)
- Beers from different fictional breweries worldwide (at least 15 different breweries)
- Detailed flavor notes (3-5 per beer) covering taste, aroma, and mouthfeel
- Food pairing notes (2-4 per beer) with specific dishes or ingredients

## Guidelines
- Beer names should be creative and memorable
- Descriptions should be 1-2 sentences, evocative and appealing
- Flavor notes should use specific sensory terms (e.g. "citrus zest", "roasted coffee", "caramel malt" rather than generic "hoppy" or "malty")
- Pairing notes should be specific (e.g. "bacon cheeseburger", "spicy jalapeño toppings", "blue cheese" rather than generic "burgers")
- Include at least 50 non-alcoholic or low-alcohol options (ABV < 1%)
- Brewery names should sound authentic and international

## Output
The output should be an array of JSON objects that conforms to the following schema:
${schema}

Use simple string IDs in the format "beer-001", "beer-002", etc.
`;
});

// ----------------------------------------------------------------------------
// Sanity check

const parsedBeers = beerCatalogSchema.parse(JSON.parse(beers));

for (const beer of parsedBeers) {
  if (beer.abv < 0 || beer.abv > 20) {
    throw new Error(`Beer ${beer.name} has an invalid ABV: ${beer.abv}`);
  }

  if (beer.flavorNotes.length === 0) {
    throw new Error(`Beer ${beer.name} has no flavor notes`);
  }

  if (beer.pairingNotes.length === 0) {
    throw new Error(`Beer ${beer.name} has no pairing notes`);
  }

  if (!beer.id.startsWith('beer-')) {
    throw new Error(`Beer ${beer.name} has an invalid ID format: ${beer.id}`);
  }
}

// Check for duplicate IDs
const ids = new Set();
for (const beer of parsedBeers) {
  if (ids.has(beer.id)) {
    throw new Error(`Duplicate beer ID: ${beer.id}`);
  }

  ids.add(beer.id);
}

console.log(`Generated ${parsedBeers.length} beers from ${new Set(parsedBeers.map((b) => b.brewery)).size} breweries`);

// ----------------------------------------------------------------------------
// Save file

await workspace.writeText('data/beers.json', beers);
