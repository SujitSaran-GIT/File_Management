import * as Minio from 'minio';

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY
});

// Ensure bucket exists
const bucketName = process.env.MINIO_BUCKET || 'documents';

minioClient.bucketExists(bucketName, (err, exists) => {
  if (err) return console.error('MinIO bucket check error:', err);
  if (!exists) {
    minioClient.makeBucket(bucketName, (err) => {
      if (err) return console.error('MinIO bucket creation error:', err);
      console.log(`MinIO bucket "${bucketName}" created`);
    });
  } else {
    console.log(`MinIO bucket "${bucketName}" exists`);
  }
});

export { minioClient, bucketName };