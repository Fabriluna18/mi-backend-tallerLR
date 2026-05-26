import db from "../config/db.js";

// ── GET /api/inventario ────────────────────────────────
export const getInventario = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id_producto, nombre, categoria, stock, precio, stock_minimo, activo
       FROM inventario
       ORDER BY activo DESC, nombre ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error("Error getInventario:", error);
    res.status(500).json({ message: "Error al obtener inventario" });
  }
};

// ── POST /api/inventario ───────────────────────────────
export const createProducto = async (req, res) => {
  const { nombre, categoria, stock, precio, stock_minimo } = req.body;

  if (!nombre || !categoria) {
    return res.status(400).json({ message: "Nombre y categoría son requeridos" });
  }

  try {
    const [existe] = await db.query(
      "SELECT id_producto FROM inventario WHERE nombre = ?", [nombre]
    );
    if (existe.length > 0) {
      return res.status(400).json({ message: "Ya existe un producto con ese nombre" });
    }

    const stockInicial = parseInt(stock) || 0;

    const [result] = await db.query(
      `INSERT INTO inventario (nombre, categoria, stock, precio, stock_minimo, activo)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [nombre, categoria, stockInicial, parseFloat(precio) || 0, parseInt(stock_minimo) || 0]
    );

    const id = result.insertId;

    // Registrar movimiento inicial si hay stock
    if (stockInicial > 0) {
      await db.query(
        `INSERT INTO inventario_movimientos (id_producto, tipo, cantidad, stock_resultante, motivo)
         VALUES (?, 'agregar', ?, ?, 'Stock inicial')`,
        [id, stockInicial, stockInicial]
      );
    }

    res.status(201).json({ id_producto: id, message: "Producto creado correctamente" });
  } catch (error) {
    console.error("Error createProducto:", error);
    res.status(500).json({ message: "Error al crear producto" });
  }
};

// ── PUT /api/inventario/:id ────────────────────────────
export const updateProducto = async (req, res) => {
  const { id } = req.params;
  const { nombre, categoria, precio, stock_minimo } = req.body;

  if (!nombre || !categoria) {
    return res.status(400).json({ message: "Nombre y categoría son requeridos" });
  }

  try {
    await db.query(
      `UPDATE inventario SET nombre=?, categoria=?, precio=?, stock_minimo=?
       WHERE id_producto=?`,
      [nombre, categoria, parseFloat(precio) || 0, parseInt(stock_minimo) || 0, id]
    );
    res.json({ message: "Producto actualizado correctamente" });
  } catch (error) {
    console.error("Error updateProducto:", error);
    res.status(500).json({ message: "Error al actualizar producto" });
  }
};

// ── PATCH /api/inventario/:id/stock ───────────────────
export const moverStock = async (req, res) => {
  const { id } = req.params;
  const { tipo, cantidad, motivo } = req.body;

  if (!tipo || !cantidad || cantidad <= 0) {
    return res.status(400).json({ message: "Tipo y cantidad válida son requeridos" });
  }

  try {
    // Obtener stock actual
    const [rows] = await db.query(
      "SELECT stock FROM inventario WHERE id_producto = ?", [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    const stockActual = rows[0].stock;
    let nuevoStock;

    if (tipo === "agregar") {
      nuevoStock = stockActual + parseInt(cantidad);
    } else if (tipo === "usar") {
      if (stockActual < parseInt(cantidad)) {
        return res.status(400).json({ message: `Stock insuficiente. Stock actual: ${stockActual}` });
      }
      nuevoStock = stockActual - parseInt(cantidad);
    } else {
      return res.status(400).json({ message: "Tipo inválido. Usar 'agregar' o 'usar'" });
    }

    // Actualizar stock
    await db.query(
      "UPDATE inventario SET stock = ? WHERE id_producto = ?",
      [nuevoStock, id]
    );

    // Registrar movimiento
    await db.query(
      `INSERT INTO inventario_movimientos (id_producto, tipo, cantidad, stock_resultante, motivo)
       VALUES (?, ?, ?, ?, ?)`,
      [id, tipo, parseInt(cantidad), nuevoStock, motivo || null]
    );

    res.json({ message: "Stock actualizado", stock: nuevoStock });
  } catch (error) {
    console.error("Error moverStock:", error);
    res.status(500).json({ message: "Error al actualizar stock" });
  }
};

// ── GET /api/inventario/:id/historial ─────────────────
export const getHistorial = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT tipo, cantidad, stock_resultante, motivo, fecha
       FROM inventario_movimientos
       WHERE id_producto = ?
       ORDER BY fecha DESC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error getHistorial:", error);
    res.status(500).json({ message: "Error al obtener historial" });
  }
};

// ── PATCH /api/inventario/:id/desactivar ──────────────
export const desactivarProducto = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(
      "UPDATE inventario SET activo = 0 WHERE id_producto = ?", [id]
    );
    res.json({ message: "Producto desactivado correctamente" });
  } catch (error) {
    console.error("Error desactivarProducto:", error);
    res.status(500).json({ message: "Error al desactivar producto" });
  }
};

// ── PATCH /api/inventario/:id/reactivar ───────────────
export const reactivarProducto = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(
      "UPDATE inventario SET activo = 1 WHERE id_producto = ?", [id]
    );
    res.json({ message: "Producto reactivado correctamente" });
  } catch (error) {
    console.error("Error reactivarProducto:", error);
    res.status(500).json({ message: "Error al reactivar producto" });
  }
};