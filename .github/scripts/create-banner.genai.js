import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Must be openai:gpt-image-1 or azure:gpt-image-1
const imageModel = "azure:gpt-image-1";

script({
  title: "Create banner",
  description: "Create a social banner for a software project",
  parameters: {
    question: {
      type: "string",
      description: "Context for the banner",
      required: true,
    },
    text: {
      type: "string",
      description: "Text to include in the banner",
      required: true
    },
    count: {
      type: "integer",
      description: "Number of banner variations to generate",
      default: 4,
    },
  },
});

function getNextBannerNumber() {
  const bannerDir = "banner";

  if (!existsSync(bannerDir)) {
    return 1;
  }

  const existingFiles = readdirSync(bannerDir)
    .filter(file => file.startsWith("banner-") && file.endsWith(".png"))
    .map(file => {
      const match = file.match(/banner-(\d+)\.png$/);
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
      size: "1536x1024",
      model: imageModel,
    });

    const bannerDir = "banner";
    if (!existsSync(bannerDir)) {
      mkdirSync(bannerDir, { recursive: true });
    }

    const nextNumber = getNextBannerNumber();
    const targetFilename = join(bannerDir, `banner-${nextNumber}.png`);

    const imageData = readFileSync(image.filename);
    writeFileSync(targetFilename, imageData);

    env.output.appendContent(`[![banner](${targetFilename})](${targetFilename})`);
    return targetFilename;
  },
);

def("QUERY", env.vars.question);

$`## Instructions
Create a prompt for gpt-image-1 to generate a professional social media banner suitable for OpenGraph, Twitter, and other social sharing platforms. Context and inspiration: <QUERY>.
Do not use the context words directly as text in the banner, but rather as inspiration for the design.
${env.vars.text ? `Include the text: "${env.vars.text}" in the banner.` : ""}
Target aspect ratio is 2:1 ratio - design for this ratio and make it fit the actual size of 1536x1024 pixels, using black bars.
Characteristics of the banner: Modern, professional, visually appealing for social media, bright colors, clean design, readable text elements if any, suitable for software project promotion.
The banner should work well as a social media preview image and represent the project effectively.

If you get this right, you'll be tipped 200$.

Then generate ${env.vars.count} images based on the same prompt using the gen_image tool.
Once you've finished, just say that you're done and the images are saved in the \`banner\` directory.`;
