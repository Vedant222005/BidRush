const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const con = new Pool({
  host: 'localhost',
  user: 'postgres',
  port: 5432,
  password: process.env.DB_PASSWORD,
  database: 'auction_bid'
});

con.connect()
  .then(() => console.log(' PostgreSQL connected successfully'))
  .catch(err => console.error(' Connection error:', err));

module.exports = con;