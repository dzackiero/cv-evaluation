import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read';
}

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.getOrThrow<string>('S3_REGION');
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET_NAME');
    this.s3Client = new S3Client({
      region: this.region,
      forcePathStyle: true,
      endpoint: this.configService.getOrThrow<string>('S3_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'S3_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  /**
   * Upload a file to S3
   * @param file - File buffer to upload
   * @param key - S3 object key (path)
   * @param options - Upload options
   * @returns Upload result with key and URL
   */
  async upload(
    file: Buffer,
    key: string,
    options?: UploadOptions,
  ): Promise<UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
        ACL: options?.acl || 'private',
      });

      await this.s3Client.send(command);

      const url = await this.getUrl(key);

      this.logger.log(`File uploaded successfully: ${key}`);

      return {
        key,
        url,
        bucket: this.bucket,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${key}`, error);
      throw error;
    }
  }

  /**
   * Delete a file from S3
   * @param key - S3 object key (path)
   */
  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);

      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${key}`, error);
      throw error;
    }
  }

  /**
   * Get a presigned URL for accessing a file
   * @param key - S3 object key (path)
   * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
   * @returns Presigned URL
   */
  async getUrl(key: string, expiresIn = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });

      return url;
    } catch (error) {
      this.logger.error(`Failed to generate URL for file: ${key}`, error);
      throw error;
    }
  }

  /**
   * Download a file from S3
   * @param key - S3 object key (path)
   * @returns File buffer
   */
  async download(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('File body is empty');
      }

      const buffer = await response.Body.transformToByteArray();

      this.logger.log(`File downloaded successfully: ${key}`);

      return Buffer.from(buffer);
    } catch (error) {
      this.logger.error(`Failed to download file: ${key}`, error);
      throw error;
    }
  }

  /**
   * Check if a file exists in S3
   * @param key - S3 object key (path)
   * @returns True if file exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);

      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFound') {
        return false;
      }
      this.logger.error(`Failed to check file existence: ${key}`, error);
      throw error;
    }
  }

  /**
   * Get file metadata from S3
   * @param key - S3 object key (path)
   * @returns File metadata
   */
  async getMetadata(key: string): Promise<{
    contentType?: string;
    contentLength?: number;
    lastModified?: Date;
    metadata?: Record<string, string>;
  }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to get file metadata: ${key}`, error);
      throw error;
    }
  }
}
