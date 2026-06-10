import dotenv from 'dotenv';
import env from 'env-var';
dotenv.config();
const config = {
  server: {
    port: env.get('PORT').required().asPortNumber(),
    nodeEnv: env.get('NODE_ENV').required().asString(),
    hostRedis: env.get('REDIS_URL').required().asString(),
    serverHost: env.get('SERVER_HOST').required().asString(),
    url: env.get('SERVER_URL').default('http://localhost:3000').asString(),
  },
  client: {
    url: env.get('CLIENT_URL').default('http://localhost:5173').asString(),
  },
  db: {
    host: env.get('DB_HOST').required().asString(),
    port: env.get('DB_PORT').required().asPortNumber(),
    user: env.get('DB_USER').required().asString(),
    password: env.get('DB_PASSWORD').required().asString(),
    name: env.get('DB_NAME').required().asString(),
    dialect: env.get('DB_DIALECT').required().asString(),
    dbUrl: env.get('DB_URL').required().asString(),
    dbUrlPro: env.get('DB_URL_PRO').required().asString()
  },
  jwt: {
    secret: env.get('JWT_SECRET').required().asString(),
    expiresIn: env.get('JWT_EXPIRES_IN').required().asString(),
  },
  email: {
    host: env.get('EMAIL_HOST').required().asString(),
    port: env.get('EMAIL_PORT').required().asPortNumber(),
    user: env.get('EMAIL_USER').required().asString(),
    password: env.get('EMAIL_PASS').required().asString(),
    from: env.get('EMAIL_FROM').required().asString(),
    appName: env.get('APP_NAME').required().asString(),
  },
  cloudinary: {
    cloud_name: env.get('CLOUDINARY_cloud_name').required().asString(),
    api_key: env.get('CLOUDINARY_api_key').required().asString(),
    api_secret: env.get('CLOUDINARY_api_secret').required().asString(),
  }
};

export default config;
