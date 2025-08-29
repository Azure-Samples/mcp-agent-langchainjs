import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Must be openai:gpt-image-1 or azure:gpt-image-1
const imageModel = "azure:gpt-image-1";

script({
  title: "Create logo",
  description: "Create the logo for a software project",
  parameters: {
    question: {
      type: "string",
      description: "2-3 keywords to use in the logo",
      required: true,
    },
    count: {
      type: "integer",
      description: "Number of logo variations to generate",
      default: 4,
    },
  },
});

function getNextLogoNumber() {
  const logoDir = "logo";

  if (!existsSync(logoDir)) {
    return 1;
  }

  const existingFiles = readdirSync(logoDir)
    .filter(file => file.startsWith("logo-") && file.endsWith(".png"))
    .map(file => {
      const match = file.match(/logo-(\d+)\.png$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .sort((a, b) => b - a);

  return existingFiles.length > 0 ? existingFiles[0] + 1 : 1;
}

defTool(
  "gen_image",
  "Generate an image",
  { prompt: "" },
  async (args) => {
    const { image } = await generateImage(args.prompt, {
      size: "1024x1024",
      model: imageModel,
    });

    const logoDir = "logo";
    if (!existsSync(logoDir)) {
      mkdirSync(logoDir, { recursive: true });
    }

    const nextNumber = getNextLogoNumber();
    const targetFilename = join(logoDir, `logo-${nextNumber}.png`);

    const imageData = readFileSync(image.filename);
    writeFileSync(targetFilename, imageData);

    env.output.appendContent(`[![logo](${targetFilename})](${targetFilename})`);
    return targetFilename;
  },
);

def("QUERY", env.vars.question);

$`## Instructions
Create a prompt for gpt-image-1 to generate a professional-looking logo icon suitable for a software project. Context and inspiration: <QUERY>.
Characteristics of the logo: Simple, vector, soft gradients, bright colors, flat, white background.
The logo MUST follow these characteristics EXACTLY. The should be usable at small icon dimensions like 64x64px.

If you get this right, you'll be tipped 200$.

Then generate ${env.vars.count} images based on the same prompt using the gen_image tool.
Once you've finished, just say that you're done and the images are saved in the \`logo\` directory.`;
