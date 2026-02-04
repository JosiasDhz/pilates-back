import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getTypeOrmConfig = (): TypeOrmModuleOptions => {
  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT,
    database: process.env.DB_NAME,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    autoLoadEntities: true,
    synchronize: true,
    ...(process.env.NODE_ENV !== 'development' && {
      ssl: true,
      extra: {
        ssl: {
          rejectUnauthorized: false,
        },
      },
    }),
    dropSchema: process.env.DB_DROP_SCHEMA === 'false' ? false : true,
  };
};
