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

const incompletePath = 'data/beers.incomplete.json';
const targetTotal = 1000;
const batchSize = 10;

const incompleteFile = await workspace.readText(incompletePath);
let allBeers = [];

if (incompleteFile?.content) {
  allBeers = JSON.parse(incompleteFile.content);
  console.log(`Resuming from ${incompletePath} with ${allBeers.length} beers...`);
}

function removeDuplicateNames(beers) {
  const seen = new Set();
  const unique = [];
  for (const beer of beers) {
    const key = beer.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(beer);
    } else {
      console.log(`  Removed duplicate: "${beer.name}" (${beer.id})`);
    }
  }
  return unique;
}

function reassignIds(beers) {
  return beers.map((beer, i) => ({ ...beer, id: `beer-${String(i + 1).padStart(4, '0')}` }));
}

while (allBeers.length < targetTotal) {
  const batchNumber = Math.floor(allBeers.length / batchSize) + 1;
  const remaining = targetTotal - allBeers.length;
  const currentBatchSize = Math.min(batchSize, remaining);
  const startId = allBeers.length + 1;
  const endId = startId + currentBatchSize - 1;
  console.log(`Generating batch ${batchNumber} (${allBeers.length}/${targetTotal}, beer-${String(startId).padStart(4, '0')} to beer-${String(endId).padStart(4, '0')})...`);

  const existingNames = allBeers.map((b) => b.name);

  const { text: batchBeers } = await runPrompt((_) => {
    const schema = _.defSchema('SCHEMA', beerCatalogSchema);
    if (existingNames.length > 0) {
      _.def('EXISTING_NAMES', JSON.stringify(existingNames), { language: 'json' });
    }

    _.$`${role}

## Task
Create ${currentBatchSize} beers for Contoso World Beers (IDs beer-${String(startId).padStart(4, '0')} to beer-${String(endId).padStart(4, '0')}). The catalog should include:
- A wide variety of styles: Lagers, IPAs, Stouts, Porters, Wheat beers, Pilsners, Belgian ales, Sours, Pale Ales, Amber Ales, Brown Ales, Red Ales, Saisons, Barleywines, and more
- Both well-known classic styles and creative craft variations
- A range of ABV levels from non-alcoholic beers (0%), light session beers (3-4%) to strong ales (8-12%) and more extreme styles (15%+)
- Beers from different fictional breweries worldwide
- Beers can have local names, ie in French, German, Spanish, etc., but the description and notes should be in English for global customers. Some local brewery have funny or unique names that reflect their culture or location. Beers can use non-latin characters (for example Asian breweries can have names in their local script), but ensure the beer name is also provided in Latin characters for readability in parentheses.
- You can do wordplays that reminds real existing breweries or beer names, but do NOT duplicate any real existing beer or brewery names. Be creative and original!
- Detailed flavor notes (3-5 per beer) covering taste, aroma, and mouthfeel
- Food pairing notes (2-4 per beer) with specific dishes or ingredients

${existingNames.length > 0 ? `## Already generated beer names
The EXISTING_NAMES variable contains the names of beers already generated. Do NOT duplicate any of these names. Ensure variety and creativity.` : ''}

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

Use IDs from beer-${String(startId).padStart(4, '0')} to beer-${String(endId).padStart(4, '0')}.
`;
  });

  try {
    const parsedBatch = beerCatalogSchema.parse(JSON.parse(batchBeers));
    console.log(`  Got ${parsedBatch.length} beers in batch ${batchNumber}`);
    allBeers.push(...parsedBatch);
    allBeers = removeDuplicateNames(allBeers);
    allBeers = reassignIds(allBeers);
    await workspace.writeText(incompletePath, JSON.stringify(allBeers, null, 2));
    console.log(`  Saved ${allBeers.length} beers to ${incompletePath}`);
  } catch (error) {
    console.warn(`  Batch ${batchNumber} produced invalid JSON, retrying...`, error.message);
  }
}

// ----------------------------------------------------------------------------
// Sanity check

for (const beer of allBeers) {
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
for (const beer of allBeers) {
  if (ids.has(beer.id)) {
    throw new Error(`Duplicate beer ID: ${beer.id}`);
  }

  ids.add(beer.id);
}

// ----------------------------------------------------------------------------
// Stats

const countries = new Set(allBeers.map((b) => b.country));
const breweries = new Set(allBeers.map((b) => b.brewery));
const styles = new Set(allBeers.map((b) => b.style));
const avgAbv = allBeers.reduce((sum, b) => sum + b.abv, 0) / allBeers.length;
const nonAlcoholic = allBeers.filter((b) => b.abv < 1).length;
const sessionBeers = allBeers.filter((b) => b.abv >= 1 && b.abv <= 4).length;
const strongBeers = allBeers.filter((b) => b.abv >= 8).length;
const minAbv = Math.min(...allBeers.map((b) => b.abv));
const maxAbv = Math.max(...allBeers.map((b) => b.abv));

console.log(`\n===== Beer Catalog Stats =====`);
console.log(`Total beers: ${allBeers.length}`);
console.log(`Unique countries: ${countries.size}`);
console.log(`Unique breweries: ${breweries.size}`);
console.log(`Unique styles: ${styles.size}`);
console.log(`ABV range: ${minAbv}% - ${maxAbv}%`);
console.log(`Average ABV: ${avgAbv.toFixed(1)}%`);
console.log(`Non-alcoholic (< 1%): ${nonAlcoholic}`);
console.log(`Session beers (1-4%): ${sessionBeers}`);
console.log(`Strong beers (8%+): ${strongBeers}`);
console.log(`==============================\n`);

// ----------------------------------------------------------------------------
// Save file

await workspace.writeText('data/beers.json', JSON.stringify(allBeers, null, 2));
await host.exec('rm', [incompletePath]);
