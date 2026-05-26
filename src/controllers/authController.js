import db from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const SECRET = process.env.SECRET;

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT * FROM usuarios WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const user = rows[0];

    // comparar contraseña encriptada
    const passwordValida = await bcrypt.compare(password, user.password);

    if (!passwordValida) {
      return res.status(401).json({ message: "Contraseña incorrecta" });
    }

    // JWT
    const token = jwt.sign(
      {
        id: user.id_usuario,
        rol: user.rol,
      },
      SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      rol: user.rol,
    });

  } catch (error) {
  console.error(error);
  res.status(500).json({ message: error.message });
  }
};