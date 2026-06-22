import 'server-only'
import { S3Client } from '@aws-sdk/client-s3'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Falta variable de entorno ${name}`)
  return value
}

export function getSpacesConfig() {
  return {
    endpoint: process.env.DO_SPACES_ENDPOINT ?? 'https://nyc3.digitaloceanspaces.com',
    region: process.env.DO_SPACES_REGION ?? 'nyc3',
    bucket: process.env.DO_SPACES_BUCKET ?? 'transporte-rosario-perez',
    accessKeyId: requireEnv('DO_SPACES_ACCESS_KEY'),
    secretAccessKey: requireEnv('DO_SPACES_SECRET_KEY'),
  }
}

let client: S3Client | null = null

export function getSpacesClient(): S3Client {
  if (client) return client
  const config = getSpacesConfig()
  client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: false,
  })
  return client
}

export function getSpacesBucket(): string {
  return process.env.DO_SPACES_BUCKET ?? 'transporte-rosario-perez'
}
