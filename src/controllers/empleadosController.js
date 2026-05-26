import db from "../config/db.js";
import bcrypt from "bcrypt";

// ── GET /api/empleados  (solo activos con rol personal — para filtro y mecánicos) ──
export const getEmpleados = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id_usuario, nombre, email, dni, rol, activo
       FROM usuarios
       WHERE activo = 1 AND rol = 'personal'
       ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error("Error getEmpleados:", error);
    res.status(500).json({ message: "Error al obtener empleados" });
  }
};

// ── GET /api/empleados/todos  (todos los roles y estados — para tabla de gestión) ──
export const getTodosEmpleados = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id_usuario, nombre, email, dni, rol, activo
       FROM usuarios
       ORDER BY activo DESC, nombre ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error("Error getTodosEmpleados:", error);
    res.status(500).json({ message: "Error al obtener empleados" });
  }
};

// ── POST /api/empleados ──
export const createEmpleado = async (req, res) => {
  const { nombre, email, password, dni, codigo, rol } = req.body;

  if (!nombre || !email || !password || !codigo) {
    return res.status(400).json({ message: "Faltan campos requeridos" });
  }

  try {
    // validar email
    const [existeEmail] = await db.query(
      "SELECT id_usuario FROM usuarios WHERE email = ?", [email]
    );
    if (existeEmail.length > 0) {
      return res.status(400).json({ message: "Ya existe un usuario con ese email" });
    }

    // validar DNI
    const [existeDni] = await db.query(
      "SELECT id_usuario FROM usuarios WHERE dni = ?", [dni]
    );
    if (dni && existeDni.length > 0) {
      return res.status(400).json({ message: "El DNI ya está registrado" });
    }

    // validar código
    const [existeCodigo] = await db.query(
      "SELECT id_usuario FROM usuarios WHERE codigo = ?", [codigo]
    );
    if (existeCodigo.length > 0) {
      return res.status(400).json({ message: "Ese código ya está en uso por otro empleado" });
    }

    const hash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO usuarios (nombre, email, password, dni, rol, codigo, activo, fecha_creacion)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
      [nombre, email, hash, dni || null, rol || "personal", codigo]
    );

    res.status(201).json({ id_usuario: result.insertId, message: "Empleado creado correctamente" });
  } catch (error) {
    console.error("Error createEmpleado:", error);
    res.status(500).json({ message: "Error al crear empleado" });
  }
};

// ── PATCH /api/empleados/:id/codigo ──
export const cambiarCodigo = async (req, res) => {
  const { id } = req.params;
  const { codigo } = req.body;

  if (!codigo) {
    return res.status(400).json({ message: "El código es requerido" });
  }

  try {
    const [existe] = await db.query(
      "SELECT id_usuario FROM usuarios WHERE codigo = ? AND id_usuario != ?",
      [codigo, id]
    );
    if (existe.length > 0) {
      return res.status(400).json({ message: "Ese código ya está en uso por otro empleado" });
    }

    await db.query(
      "UPDATE usuarios SET codigo = ? WHERE id_usuario = ?",
      [codigo, id]
    );
    res.json({ message: "Código actualizado correctamente" });
  } catch (error) {
    console.error("Error cambiarCodigo:", error);
    res.status(500).json({ message: "Error al cambiar el código" });
  }
};

// ── PATCH /api/empleados/:id/desactivar ──
export const desactivarEmpleado = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE usuarios SET activo = 0 WHERE id_usuario = ?", [id]);
    res.json({ message: "Empleado desactivado correctamente" });
  } catch (error) {
    console.error("Error desactivarEmpleado:", error);
    res.status(500).json({ message: "Error al desactivar empleado" });
  }
};

// ── PATCH /api/empleados/:id/reactivar ──
export const reactivarEmpleado = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE usuarios SET activo = 1 WHERE id_usuario = ?", [id]);
    res.json({ message: "Empleado reactivado correctamente" });
  } catch (error) {
    console.error("Error reactivarEmpleado:", error);
    res.status(500).json({ message: "Error al reactivar empleado" });
  }
};

// ── POST /api/empleados/registrar ──
export const registrarAsistencia = async (req, res) => {
  const { codigo } = req.body;

  if (!codigo) {
    return res.status(400).json({ message: "Código requerido" });
  }

  try {
    const [usuarios] = await db.query(
      "SELECT id_usuario, nombre FROM usuarios WHERE codigo = ? AND activo = 1",
      [codigo]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ message: "Código incorrecto" });
    }

    const usuario = usuarios[0];
    const hoy = new Date().toISOString().split("T")[0];

    const [ultimos] = await db.query(
      `SELECT id_asistencia, hora_entrada, hora_salida
       FROM asistencias
       WHERE usuario_id = ? AND fecha = ?
       ORDER BY id_asistencia DESC
       LIMIT 1`,
      [usuario.id_usuario, hoy]
    );

    if (ultimos.length === 0 || ultimos[0].hora_salida !== null) {
      await db.query(
        "INSERT INTO asistencias (usuario_id, fecha, hora_entrada) VALUES (?, ?, NOW())",
        [usuario.id_usuario, hoy]
      );
      return res.json({ message: `✅ Bienvenido, ${usuario.nombre}! Entrada registrada.` });
    } else {
      await db.query(
        "UPDATE asistencias SET hora_salida = NOW() WHERE id_asistencia = ?",
        [ultimos[0].id_asistencia]
      );
      return res.json({ message: `👋 Hasta luego, ${usuario.nombre}! Salida registrada.` });
    }
  } catch (error) {
    console.error("Error registrarAsistencia:", error);
    res.status(500).json({ message: "Error al registrar asistencia" });
  }
};

// ── GET /api/empleados/asistencias-hoy ──
export const getAsistenciasHoy = async (req, res) => {
  try {
    const hoy = new Date().toISOString().split("T")[0];

    const [rows] = await db.query(
      `SELECT a.id_asistencia, a.usuario_id, a.hora_entrada, a.hora_salida, u.nombre
       FROM asistencias a
       JOIN usuarios u ON u.id_usuario = a.usuario_id
       WHERE a.fecha = ?
       ORDER BY a.hora_entrada ASC`,
      [hoy]
    );

    const asistencias = [];
    const estadoEmpleado = {};

    for (const row of rows) {
      asistencias.push({
        usuario_id:   row.usuario_id,
        nombre:       row.nombre,
        tipo:         "entrada",
        hora_entrada: row.hora_entrada,
      });

      if (row.hora_salida) {
        asistencias.push({
          usuario_id:  row.usuario_id,
          nombre:      row.nombre,
          tipo:        "salida",
          hora_salida: row.hora_salida,
        });
        estadoEmpleado[row.usuario_id] = "salio";
      } else {
        estadoEmpleado[row.usuario_id] = "presente";
      }
    }

    let presentes = 0, salieron = 0;
    for (const estado of Object.values(estadoEmpleado)) {
      if (estado === "presente") presentes++;
      else salieron++;
    }

    res.json({ asistencias, stats: { presentes, salieron } });
  } catch (error) {
    console.error("Error getAsistenciasHoy:", error);
    res.status(500).json({ message: "Error al obtener asistencias" });
  }
};