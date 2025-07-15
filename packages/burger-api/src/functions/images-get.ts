import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { BlobService } from '../blob-service';

app.http('images-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'images/{*filepath}',
  handler: async (request: HttpRequest, context: InvocationContext) => {
    context.log('Processing image retrieval request...');
    context.log('Request path:', request.params.filepath);

    const filepath = request.params.filepath;

    if (!filepath) {
      return {
        jsonBody: { error: 'Image path is required' },
        status: 400,
      };
    }

    // Get blob service instance
    const blobService = await BlobService.getInstance();

    // Get blob data
    const imageData = await blobService.getBlob(filepath);

    if (!imageData) {
      return {
        jsonBody: { error: 'Image not found' },
        status: 404,
      };
    }

    // Get content type based on file extension
    const contentType = blobService.getContentType(filepath);

    // Return the image data
    return {
      body: imageData,
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    };
  },
});
