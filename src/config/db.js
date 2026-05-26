import mysql from "mysql2";

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "taller2",
});

export default db.promise();