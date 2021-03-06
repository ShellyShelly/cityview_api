require('./config/config-env');


// TODO: check does db properly work with cyrilic, etc encodings
module.exports = {
  client: 'mysql',
  version: '5.7.2',
  connection: {
    connectionLimit: 50,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  },
  pool: {
    min: 1,
    max: 50,
  },
  migrations: {
    directory: './database/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './database/seeds',
  },
};
