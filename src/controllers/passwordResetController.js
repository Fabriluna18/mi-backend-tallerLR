import crypto from "crypto";
import bcrypt from "bcrypt";
import db from "../config/db.js";
import { enviarEmailRecuperacion } from "../services/emailService.js";

// Solicitar recuperación de contraseña
export const solicitarRecuperacion = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "El email es requerido" });
  }

  try {
    // Verificar si el usuario existe
    const [usuarios] = await db.query(
      "SELECT id_usuario, nombre, email FROM usuarios WHERE email = ?",
      [email]
    );

    // Por seguridad, siempre devolver éxito aunque el email no exista
    if (usuarios.length === 0) {
      return res.status(200).json({
        message: "Si el email existe, recibirás un correo de recuperación",
      });
    }

    const usuario = usuarios[0];

    // Generar token único
    const token = crypto.randomBytes(32).toString("hex");
    const fechaExpiracion = new Date(Date.now() + 3600000); // 1 hora

    // Guardar token en BD
    await db.query(
      "INSERT INTO password_reset_tokens (id_usuario, token, fecha_expiracion) VALUES (?, ?, ?)",
      [usuario.id_usuario, token, fechaExpiracion]
    );

    // Enviar email
    await enviarEmailRecuperacion(email, token);

    res.status(200).json({
      message: "Si el email existe, recibirás un correo de recuperación",
    });
  } catch (error) {
    console.error("Error en recuperación:", error);
    res.status(500).json({ message: "Error al procesar la solicitud" });
  }
};

// Verificar si el token es válido
export const verificarToken = async (req, res) => {
  const { token } = req.params;

  try {
    const [tokens] = await db.query(
      `SELECT t.*, u.email 
       FROM password_reset_tokens t
       JOIN usuarios u ON t.id_usuario = u.id_usuario
       WHERE t.token = ? AND t.usado = 0 AND t.fecha_expiracion > NOW()`,
      [token]
    );

    if (tokens.length === 0) {
      return res.status(400).json({
        valid: false,
        message: "Token inválido o expirado",
      });
    }

    res.status(200).json({
      valid: true,
      email: tokens[0].email,
    });
  } catch (error) {
    console.error("Error verificando token:", error);
    res.status(500).json({ message: "Error al verificar el token" });
  }
};

// Restablecer contraseña
export const restablecerPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({
      message: "La contraseña debe tener al menos 6 caracteres",
    });
  }

  try {
    // Verificar token
    const [tokens] = await db.query(
      `SELECT id_token, id_usuario 
       FROM password_reset_tokens 
       WHERE token = ? AND usado = 0 AND fecha_expiracion > NOW()`,
      [token]
    );

    if (tokens.length === 0) {
      return res.status(400).json({ message: "Token inválido o expirado" });
    }

    const { id_token, id_usuario } = tokens[0];

    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Actualizar contraseña del usuario
    await db.query("UPDATE usuarios SET password = ? WHERE id_usuario = ?", [
      hashedPassword,
      id_usuario,
    ]);

    // Marcar token como usado
    await db.query("UPDATE password_reset_tokens SET usado = 1 WHERE id_token = ?", [
      id_token,
    ]);

    res.status(200).json({
      message: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    console.error("Error restableciendo contraseña:", error);
    res.status(500).json({ message: "Error al restablecer la contraseña" });
  }
};