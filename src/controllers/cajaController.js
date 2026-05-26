import db from "../config/db.js";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

const TIPOS_POSITIVOS = ["venta"];
const TIPOS_NEGATIVOS = ["gasto", "retiro"];

const TIPOS_VALIDOS = [
  "venta",
  "gasto",
  "retiro",
];

const obtenerHoy = () => {
  return new Date().toISOString().split("T")[0];
};

const signoMonto = (tipo, monto) => {
  const t = (tipo || "").toLowerCase();

  if (TIPOS_POSITIVOS.includes(t)) {
    return Math.abs(Number(monto));
  }

  if (TIPOS_NEGATIVOS.includes(t)) {
    return -Math.abs(Number(monto));
  }

  return 0;
};

const validarMonto = (monto) => {
  const numero = Number(monto);

  if (isNaN(numero) || numero < 0) {
    return null;
  }

  return Number(numero.toFixed(2));
};

// ─────────────────────────────────────────
// ESTADO CAJA
// ─────────────────────────────────────────

const obtenerEstadoCaja = async () => {

  const hoy = obtenerHoy();

  const fechaInicio = `${hoy} 00:00:00`;
  const fechaFin = `${hoy} 23:59:59`;

  const [rows] = await db.query(
    `
    SELECT tipo
    FROM caja
    WHERE fecha BETWEEN ? AND ?
    AND activo = 1
    AND tipo IN ('apertura', 'cierre')
    ORDER BY fecha DESC, id_movimiento DESC
    LIMIT 1
    `,
    [fechaInicio, fechaFin]
  );

  if (rows.length === 0) {
    return "sin_apertura";
  }

  return rows[0].tipo === "apertura"
    ? "abierta"
    : "cerrada";
};

// ─────────────────────────────────────────
// GET CAJA
// ─────────────────────────────────────────

export const getCajaHoy = async (req, res) => {

  try {

    const periodo = req.query.periodo || "dia";

    // ──────────────────────────────────────
    // SIEMPRE obtener la caja del DÍA ACTUAL
    // ──────────────────────────────────────

    const hoy = new Date();
    const hoyInicio = new Date(hoy);
    hoyInicio.setHours(0, 0, 0, 0);
    const hoyFin = new Date(hoy);
    hoyFin.setHours(23, 59, 59, 999);

    const estadoCaja = await obtenerEstadoCaja();

    // Obtener movimientos del DÍA ACTUAL para calcular la caja
    const [movsHoy] = await db.query(
    `
    SELECT
      c.*,
      u.nombre AS usuario_nombre,
      u.tipo_usuario AS usuario_rol  /* ✅ AGREGAR ESTA LÍNEA */
    FROM caja c
    LEFT JOIN usuarios u
    ON u.id_usuario = c.usuario_id
    WHERE c.fecha BETWEEN ? AND ?
    AND c.activo = 1
    ORDER BY c.fecha ASC
    `,
    [hoyInicio, hoyFin]
  );

    // ──────────────────────────────────────
    // OBTENER DATOS DE APERTURA Y CIERRE DEL DÍA
    // ⚠️ IMPORTANTE: Definir ANTES de calcular totales
    // ──────────────────────────────────────

    // ──────────────────────────────────────
    // OBTENER DATOS DE APERTURA Y CIERRE DEL DÍA
    // ⚠️ IMPORTANTE: Definir ANTES de calcular totales
    // ──────────────────────────────────────

    const apertura = movsHoy.find(
      (m) => m.tipo === "apertura"
    );

    const cierre = movsHoy.find(
      (m) => m.tipo === "cierre"
    );

    // ✅ CONVERTIR A NÚMERO
    const fondoInicial = Number(apertura?.monto) || 0;

    // ──────────────────────────────────────
    // CALCULAR TOTALES DEL DÍA ACTUAL
    // ──────────────────────────────────────

    let totalSistemaHoy = 0;

    const resumenHoy = {
      efectivo: 0,
      transferencia: 0,
      tarjeta: 0,
    };


    movsHoy.forEach((m) => {


      // No contar apertura ni cierre en el total
      if (
        m.tipo !== "apertura" &&
        m.tipo !== "cierre"
      ) {
        const montoConSigno = signoMonto(m.tipo, m.monto);
        
        totalSistemaHoy += montoConSigno;

        // ✅ CORREGIDO: Calcular resumen solo con ENTRADAS (ventas)
        const metodo = (m.metodo || "efectivo").toLowerCase();
        
        if (TIPOS_POSITIVOS.includes(m.tipo)) {
          const montoPositivo = Math.abs(Number(m.monto));
          
          if (metodo === "efectivo") {
            resumenHoy.efectivo += montoPositivo;
          } else if (metodo === "transferencia") {
            resumenHoy.transferencia += montoPositivo;
          } else if (metodo === "tarjeta") {
            resumenHoy.tarjeta += montoPositivo;
          }
        }
      }
    });


    // Construir objeto caja con los datos de apertura
    const cajaObj = apertura ? {
      id_movimiento: apertura.id_movimiento,
      monto_apertura: apertura.monto,
      hora_apertura: apertura.fecha,
      concepto: apertura.concepto,
      usuario_id: apertura.usuario_id,
      usuario_nombre: apertura.usuario_nombre,
    } : null;

    // Datos de cierre (si existe)
    let totalReal = null;
    let diferencia = null;

    if (cierre) {
      totalReal = cierre.monto;
      diferencia = totalReal - (totalSistemaHoy + fondoInicial);
    }

    // ──────────────────────────────────────
    // OBTENER MOVIMIENTOS SEGÚN EL PERÍODO
    // ──────────────────────────────────────

    let fechaInicio = new Date();
    let fechaFin = new Date();

    if (periodo === "dia" || periodo === "hoy") {

      fechaInicio.setHours(0, 0, 0, 0);
      fechaFin.setHours(23, 59, 59, 999);

    } else if (periodo === "semana") {

      fechaInicio.setDate(
        fechaInicio.getDate() - 7
      );

      fechaInicio.setHours(0, 0, 0, 0);
      fechaFin.setHours(23, 59, 59, 999);

    } else if (periodo === "mes") {

      fechaInicio.setMonth(
        fechaInicio.getMonth() - 1
      );

      fechaInicio.setHours(0, 0, 0, 0);
      fechaFin.setHours(23, 59, 59, 999);
    }

    // Consulta separada para movimientos del período seleccionado
    const [movsPeriodo] = await db.query(
      `
      SELECT
        c.*,
        u.nombre AS usuario_nombre,
        u.tipo_usuario AS usuario_rol  /* ✅ AGREGAR ESTA LÍNEA */
      FROM caja c
      LEFT JOIN usuarios u
      ON u.id_usuario = c.usuario_id
      WHERE c.fecha BETWEEN ? AND ?
      AND c.activo = 1
      ORDER BY c.fecha ASC
      `,
      [fechaInicio, fechaFin]
    );

    // ──────────────────────────────────────
    // RESPUESTA
    // ──────────────────────────────────────

    res.json({
      estado: estadoCaja,
      caja: cajaObj,
      movimientos: movsPeriodo, // Movimientos del período seleccionado
      resumen: resumenHoy, // Resumen del DÍA ACTUAL
      total_sistema: totalSistemaHoy + fondoInicial, // Total del DÍA incluyendo fondo inicial
      fondo_inicial: fondoInicial,
      total_operaciones: totalSistemaHoy, // Solo operaciones del DÍA (sin fondo inicial)
      total_real: totalReal,
      diferencia: diferencia,
    });

  } catch (error) {

    console.error(
      "Error getCajaHoy:",
      error
    );

    res.status(500).json({
      message: "Error al obtener caja",
    });
  }
};

// ─────────────────────────────────────────
// ABRIR CAJA
// ─────────────────────────────────────────

export const abrirCaja = async (req, res) => {

  try {

    const {
      monto,
      metodo,
      motivo,
    } = req.body;

    const usuario_id = req.user.id;

    const estado =
      await obtenerEstadoCaja();

    if (estado === "abierta") {
      return res.status(400).json({
        message: "La caja ya está abierta",
      });
    }

    await db.query(
      `
      INSERT INTO caja (
        usuario_id,
        tipo,
        concepto,
        monto,
        metodo,
        fecha,
        activo
      )
      VALUES (?, 'apertura', ?, ?, ?, NOW(), 1)
      `,
      [
        usuario_id,
        motivo,
        monto,
        metodo || "efectivo",
      ]
    );

    res.json({
      message: "Caja abierta",
    });

  } catch (error) {

    console.error(
      "Error abrirCaja:",
      error
    );

    res.status(500).json({
      message: "Error al abrir caja",
    });
  }
};

// ─────────────────────────────────────────
// MOVIMIENTO
// ─────────────────────────────────────────

export const registrarMovimiento =
async (req, res) => {

  try {

    const {
      tipo,
      concepto,
      monto,
      metodo,
    } = req.body;

    const usuario_id = req.user.id;

    await db.query(
      `
      INSERT INTO caja (
        usuario_id,
        tipo,
        concepto,
        monto,
        metodo,
        fecha,
        activo
      )
      VALUES (?, ?, ?, ?, ?, NOW(), 1)
      `,
      [
        usuario_id,
        tipo,
        concepto,
        monto,
        metodo || "efectivo",
      ]
    );

    res.json({
      message:
        "Movimiento registrado",
    });

  } catch (error) {

    console.error(
      "Error registrarMovimiento:",
      error
    );

    res.status(500).json({
      message:
        "Error al registrar movimiento",
    });
  }
};

// ─────────────────────────────────────────
// CERRAR CAJA
// ─────────────────────────────────────────

export const cerrarCaja = async (
  req,
  res
) => {

  try {

    const {
      monto_real,
      motivo,
    } = req.body;

    const usuario_id = req.user.id;

    await db.query(
      `
      INSERT INTO caja (
        usuario_id,
        tipo,
        concepto,
        monto,
        fecha,
        activo
      )
      VALUES (?, 'cierre', ?, ?, NOW(), 1)
      `,
      [
        usuario_id,
        motivo,
        monto_real,
      ]
    );

    res.json({
      message:
        "Caja cerrada correctamente",
    });

  } catch (error) {

    console.error(
      "Error cerrarCaja:",
      error
    );

    res.status(500).json({
      message:
        "Error al cerrar caja",
    });
  }
};

// ─────────────────────────────────────────
// REABRIR CAJA
// ─────────────────────────────────────────

export const reabrirCaja = async (
  req,
  res
) => {

  try {

    const {
      motivo,
      monto,
      metodo,
    } = req.body;

    const usuario_id = req.user.id;

    await db.query(
      `
      INSERT INTO caja (
        usuario_id,
        tipo,
        concepto,
        monto,
        metodo,
        fecha,
        activo
      )
      VALUES (?, 'apertura', ?, ?, ?, NOW(), 1)
      `,
      [
        usuario_id,
        motivo,
        monto,
        metodo || "efectivo",
      ]
    );

    res.json({
      message:
        "Caja reabierta correctamente",
    });

  } catch (error) {

    console.error(
      "Error reabrirCaja:",
      error
    );

    res.status(500).json({
      message:
        "Error al reabrir caja",
    });
  }
};

// ─────────────────────────────────────────
// RESUMEN
// ─────────────────────────────────────────

export const getMovimientosResumen =
async (req, res) => {

  try {

    const { filtro = "hoy" } =
      req.query;

    let where = "1=1";

    if (
      filtro === "hoy" ||
      filtro === "dia"
    ) {
      where =
        "DATE(c.fecha)=CURDATE()";
    }

    if (filtro === "semana") {
      where = `
        YEARWEEK(c.fecha,1)=YEARWEEK(CURDATE(),1)
      `;
    }

    if (filtro === "mes") {
      where = `
        MONTH(c.fecha)=MONTH(CURDATE())
        AND YEAR(c.fecha)=YEAR(CURDATE())
      `;
    }

    const [movimientos] =
      await db.query(
        `
        SELECT *
        FROM caja c
        WHERE ${where}
        ORDER BY c.fecha DESC
        `
      );

    res.json({
      movimientos,
    });

  } catch (error) {

    console.error(
      "Error getMovimientosResumen:",
      error
    );

    res.status(500).json({
      message:
        "Error al obtener resumen",
    });
  }
};