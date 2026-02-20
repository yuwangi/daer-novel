import COS from 'cos-nodejs-sdk-v5';
import fs from 'fs';
import { logger } from '../utils/logger';

class COSService {
  private cos: COS;
  private bucket: string;
  private region: string;

  constructor() {
    this.cos = new COS({
      SecretId: process.env.COS_SECRET_ID || '',
      SecretKey: process.env.COS_SECRET_KEY || '',
    });
    this.bucket = process.env.COS_BUCKET || '';
    this.region = process.env.COS_REGION || 'ap-beijing';
  }

  /**
   * Upload a local file to COS
   * @param localPath Path to the local file
   * @param key COS key (path in bucket)
   * @returns URL of the uploaded file
   */
  async uploadFile(localPath: string, key: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.cos.putObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
          Body: fs.createReadStream(localPath),
        },
        (err, data) => {
          if (err) {
            logger.error('COS upload failed:', err);
            reject(err);
          } else {
            // Data.Location usually looks like "bucket-appid.cos.region.myqcloud.com/key"
            // We want to return the full URL with https://
            const url = data.Location.startsWith('http') 
              ? data.Location 
              : `https://${data.Location}`;
            logger.info(`File uploaded to COS: ${url}`);
            resolve(url);
          }
        }
      );
    });
  }

  /**
   * Upload a buffer to COS
   */
  async uploadBuffer(buffer: Buffer, key: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.cos.putObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
          Body: buffer,
        },
        (err, data) => {
          if (err) {
            logger.error('COS buffer upload failed:', err);
            reject(err);
          } else {
            const url = data.Location.startsWith('http') 
              ? data.Location 
              : `https://${data.Location}`;
            resolve(url);
          }
        }
      );
    });
  }
}

export const cosService = new COSService();
