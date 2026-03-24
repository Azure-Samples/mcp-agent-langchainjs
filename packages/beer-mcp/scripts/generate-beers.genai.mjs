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
  country: z.string(),
  abv: z.number(),
  description: z.string(),
  flavorNotes: z.array(z.string()),
  pairingNotes: z.array(z.string()),
});
const beerCatalogSchema = z.array(beerSchema);

const uncheckedPath = 'data/beers.unchecked.json';
const uncheckedFile = await workspace.readText(uncheckedPath);
let allBeers = [];

if (uncheckedFile?.content) {
  console.log('Found existing beers.unchecked.json, skipping generation...');
  allBeers = JSON.parse(uncheckedFile.content);
} else {
  const batchSize = 100;
  const totalBatches = 10;

for (let batch = 0; batch < totalBatches; batch++) {
  const startId = batch * batchSize + 1;
  const endId = startId + batchSize - 1;
  console.log(`Generating batch ${batch + 1}/${totalBatches} (beer-${String(startId).padStart(3, '0')} to beer-${String(endId).padStart(3, '0')})...`);

  const { text: batchBeers } = await runPrompt((_) => {
    const schema = _.defSchema('SCHEMA', beerCatalogSchema);
    if (allBeers.length > 0) {
      _.def('EXISTING_BEERS', JSON.stringify(allBeers, null, 2), { language: 'json' });
    }

    _.$`${role}

## Task
Create ${batchSize} beers for Contoso World Beers (IDs beer-${String(startId).padStart(3, '0')} to beer-${String(endId).padStart(3, '0')}). The catalog should include:
- A wide variety of styles: Lagers, IPAs, Stouts, Porters, Wheat beers, Pilsners, Belgian ales, Sours, Pale Ales, Amber Ales, Brown Ales, Red Ales, Saisons, Barleywines, and more
- Both well-known classic styles and creative craft variations
- A range of ABV levels from non-alcoholic beers (0%), light session beers (3-4%) to strong ales (8-12%) and more extreme styles (15%+)
- Beers from different fictional breweries worldwide
- Beers can have local names, ie in French, German, Spanish, etc., but the description and notes should be in English for global customers. Some local brewery have funny or unique names that reflect their culture or location. Beers can use non-latin characters (for example Asian breweries can have names in their local script), but ensure the beer name is also provided in Latin characters for readability in parentheses.
- You can do wordplays that reminds real existing breweries or beer names, but do NOT duplicate any real existing beer or brewery names. Be creative and original!
- Detailed flavor notes (3-5 per beer) covering taste, aroma, and mouthfeel
- Food pairing notes (2-4 per beer) with specific dishes or ingredients

${allBeers.length > 0 ? `## Already generated beers
The EXISTING_BEERS variable contains beers already generated. Do NOT duplicate any beer names, styles+brewery combinations, or descriptions. Ensure variety and creativity.` : ''}

## Guidelines
- Beer names should be creative and memorable
- Descriptions should be 1-2 sentences, evocative and appealing
- Flavor notes should use specific sensory terms (e.g. "citrus zest", "roasted coffee", "caramel malt" rather than generic "hoppy" or "malty")
- Pairing notes should be specific (e.g. "bacon cheeseburger", "spicy jalapeño toppings", "blue cheese" rather than generic "burgers")
- Include some non-alcoholic or low-alcohol options (ABV < 1%)
- Brewery names should sound authentic and international

## Output
The output should be an array of JSON objects that conforms to the following schema:
${schema}

Use IDs from beer-${String(startId).padStart(3, '0')} to beer-${String(endId).padStart(3, '0')}.
`;
  });

  try {
    const parsedBatch = beerCatalogSchema.parse(JSON.parse(batchBeers));
    console.log(`  Got ${parsedBatch.length} beers in batch ${batch + 1}`);
    allBeers.push(...parsedBatch);
  } catch (error) {
    console.warn(`  Batch ${batch + 1} produced invalid JSON, retrying...`, error.message);
    batch--;
  }
}

  await workspace.writeText(uncheckedPath, JSON.stringify(allBeers, null, 2));
  console.log(`Saved unchecked beers to ${uncheckedPath}`);
}

// ----------------------------------------------------------------------------
// Sanity check

const parsedBeers = allBeers;

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

await workspace.writeText('data/beers.json', JSON.stringify(allBeers, null, 2));
await host.exec('rm', [uncheckedPath]);
