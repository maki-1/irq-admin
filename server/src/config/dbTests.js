const mongoose = require('mongoose');

let conn = null;

const getTestsConn = async () => {
  if (conn && conn.readyState === 1) return conn;
  // Inject /tests database name into the URI (URI ends with .net/?...)
  const uri = process.env.MONGO_URI.replace('/?', '/tests?');
  conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  }).asPromise();
  return conn;
};

module.exports = { getTestsConn };
