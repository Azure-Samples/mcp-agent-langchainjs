import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import dotenv from 'dotenv';

// Env file is located in the root of the repository
dotenv.config({ path: path.join(process.cwd(), '../../.env') });

export class BlobService {
  private static instance: BlobService;
  private blobServiceClient: BlobServiceClient | undefined;
  private containerClient: ContainerClient | undefined;
  private isInitialized = false;
  private useLocalFallback = false;

  public static async getInstance(): Promise<BlobService> {
    if (!BlobService.instance) {
      BlobService.instance = new BlobService();
      await BlobService.instance.initialize();
    }

    return BlobService.instance;
  }

  protected async initialize(): Promise<void> {
    try {
      const storageUrl = process.env.AZURE_STORAGE_URL;
      const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'blobs';

      if (!storageUrl) {
        console.warn('Azure Storage URL not found in environment variables. Using local filesystem fallback.');
        this.useLocalFallback = true;
        return;
      }

      // Use DefaultAzureCredential for managed identity
      const credential = new DefaultAzureCredential();

      this.blobServiceClient = new BlobServiceClient(storageUrl, credential);
      this.containerClient = this.blobServiceClient.getContainerClient(containerName);

      // Check if container exists
      const exists = await this.containerClient.exists();
      if (!exists) {
        console.warn(`Container '${containerName}' does not exist.`);
        return;
      }

      this.isInitialized = true;
      console.log('Successfully connected to Azure Blob Storage');

      // Check if images are already uploaded and upload them if needed
      await this.ensureImagesUploaded();
    } catch (error) {
      console.error('Failed to initialize Azure Blob Storage:', error);
    }
  }

  /**
   * Checks if images exist in blob storage and uploads them if they don't
   */
  private async ensureImagesUploaded(): Promise<void> {
    if (!this.isInitialized || !this.containerClient) {
      return;
    }

    try {
      // Check if first image exists
      const firstImageName = 'burger-pic-1.jpg';
      const blobClient = this.containerClient.getBlobClient(firstImageName);
      const imageExists = await blobClient.exists();

      if (imageExists) {
        console.log('Images already exist in blob storage');
      } else {
        console.log('First image not found in blob storage. Uploading all images...');
        await this.uploadAllImages();
      }
    } catch (error) {
      console.error('Error checking image existence:', error);
    }
  }

  /**
   * Uploads all image files from the data/images directory to blob storage
   */
  private async uploadAllImages(): Promise<void> {
    if (!this.isInitialized || !this.containerClient) {
      return;
    }

    try {
      // Path to the images directory
      const imagesDirectory = path.join(process.cwd(), 'data', 'images');

      // Get all jpg files in the directory
      const allFiles = await fs.readdir(imagesDirectory);
      const imageFiles = allFiles.filter((file) => file.endsWith('.jpg'));

      console.log(`Found ${imageFiles.length} images to upload`);

      // Upload all images in parallel
      const { containerClient } = this;
      const uploadPromises = imageFiles.map(async (imageFile) => {
        const filePath = path.join(imagesDirectory, imageFile);
        const fileContent = await fs.readFile(filePath);

        const blockBlobClient = containerClient.getBlockBlobClient(imageFile);

        await blockBlobClient.upload(fileContent, fileContent.length, {
          blobHTTPHeaders: {
            blobContentType: 'image/jpeg',
          },
        });

        console.log(`Uploaded ${imageFile}`);
        return imageFile;
      });

      await Promise.all(uploadPromises);
      console.log('All images uploaded successfully');
    } catch (error) {
      console.error('Error uploading images:', error);
    }
  }

  /**
   * Get a blob from Azure Blob Storage or local filesystem if Azure Storage is not configured
   * @param blobName The name of the blob to retrieve
   * @returns The blob data as a Buffer or undefined if not found
   */
  public async getBlob(blobName: string): Promise<Buffer | undefined> {
    // Check if we should use local fallback
    if (this.useLocalFallback) {
      return this.getLocalFile(blobName);
    }

    // Use Azure Blob Storage when available
    if (!this.isInitialized || !this.containerClient) {
      console.warn('Blob Service not initialized');
      return undefined;
    }

    try {
      const blobClient = this.containerClient.getBlobClient(blobName);

      // Check if blob exists
      const exists = await blobClient.exists();
      if (!exists) {
        console.warn(`Blob '${blobName}' does not exist.`);
        return undefined;
      }

      const downloadResponse = await blobClient.download();

      if (!downloadResponse.readableStreamBody) {
        return undefined;
      }

      // Convert stream to buffer
      return await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        const stream = downloadResponse.readableStreamBody!;

        stream.on('data', (data) => {
          chunks.push(Buffer.from(data));
        });

        stream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        stream.on('error', reject);
      });
    } catch (error) {
      console.error(`Error retrieving blob '${blobName}':`, error);
      return undefined;
    }
  }

  /**
   * Check if a path exists in the local filesystem
   * @param path The path to check
   * @returns True if the path exists, false otherwise
   */
  private async pathExists(path: string) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get a file from the local filesystem
   * @param fileName The name of the file to retrieve
   * @returns The file data as a Buffer or undefined if not found
   */
  private async getLocalFile(fileName: string): Promise<Buffer | undefined> {
    try {
      const filePath = path.join(process.cwd(), 'data', 'images', fileName);

      // Check if file exists
      if (!(await this.pathExists(filePath))) {
        console.warn(`Local file '${fileName}' not found at path: ${filePath}`);
        return undefined;
      }

      // Read file
      const fileContent = await fs.readFile(filePath);
      console.log(`Loaded local file: ${fileName}`);
      return fileContent;
    } catch (error) {
      console.error(`Error reading local file '${fileName}':`, error);
      return undefined;
    }
  }

  /**
   * Get the content type for a blob based on its file extension
   * @param blobName The name of the blob
   * @returns The content type string
   */
  public getContentType(blobName: string): string {
    const extension = blobName.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'jpg':
      case 'jpeg': {
        return 'image/jpeg';
      }

      case 'png': {
        return 'image/png';
      }

      case 'gif': {
        return 'image/gif';
      }

      case 'webp': {
        return 'image/webp';
      }

      case 'svg': {
        return 'image/svg+xml';
      }

      default: {
        return 'application/octet-stream';
      }
    }
  }
}
