import db from "../config/db.js";

// ── GET /api/servicios (solo activos — para el selector de órdenes) ──
export const getServicios = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id_servicio, nombre, precio_base FROM servicios WHERE activo = 1 ORDER BY nombre"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error getServicios:", error);
    res.status(500).json({ message: "Error al obtener servicios" });
  }
};

// ── GET /api/servicios/all (todos — para el ABM) ──
export const getAllServicios = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM servicios ORDER BY activo DESC, nombre ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error getAllServicios:", error);
    res.status(500).json({ message: "Error al obtener servicios" });
  }
};

// ── POST /api/servicios ──
export const createServicio = async (req, res) => {
  const { nombre, descripcion, precio_base, tiempo_estimado } = req.body;
  if (!nombre || !precio_base) {
    return res.status(400).json({ message: "Nombre y precio son requeridos" });
  }
  try {
    const [existe] = await db.query(
      "SELECT id_servicio FROM servicios WHERE nombre = ?", [nombre]
    );
    if (existe.length > 0) {
      return res.status(400).json({ message: "Ya existe un servicio con ese nombre" });
    }
    const [result] = await db.query(
      `INSERT INTO servicios (nombre, descripcion, precio_base, tiempo_estimado, activo)
       VALUES (?, ?, ?, ?, 1)`,
      [nombre, descripcion || "", precio_base, tiempo_estimado || null]
    );
    res.status(201).json({ id_servicio: result.insertId, message: "Servicio creado" });
  } catch (error) {
    console.error("Error createServicio:", error);
    res.status(500).json({ message: "Error al crear servicio" });
  }
};

// ── PUT /api/servicios/:id ──
export const updateServicio = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, precio_base, tiempo_estimado } = req.body;
  if (!nombre || !precio_base) {
    return res.status(400).json({ message: "Nombre y precio son requeridos" });
  }
  try {
    await db.query(
      `UPDATE servicios SET nombre=?, descripcion=?, precio_base=?, tiempo_estimado=?
       WHERE id_servicio=?`,
      [nombre, descripcion || "", precio_base, tiempo_estimado || null, id]
    );
    res.json({ message: "Servicio actualizado" });
  } catch (error) {
    console.error("Error updateServicio:", error);
    res.status(500).json({ message: "Error al actualizar servicio" });
  }
};

// ── PATCH /api/servicios/:id/desactivar ──
export const desactivarServicio = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE servicios SET activo = 0 WHERE id_servicio = ?", [id]);
    res.json({ message: "Servicio desactivado" });
  } catch (error) {
    console.error("Error desactivarServicio:", error);
    res.status(500).json({ message: "Error al desactivar servicio" });
  }
};

// ── PATCH /api/servicios/:id/reactivar ──
export const reactivarServicio = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("UPDATE servicios SET activo = 1 WHERE id_servicio = ?", [id]);
    res.json({ message: "Servicio reactivado" });
  } catch (error) {
    res.status(500).json({ message: "Error al reactivar servicio" });
  }
};