import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import passwordResetRoutes from "./routes/passwordResetRoutes.js"
import dashboardRoutes from "./routes/dashboardRoutes.js";
import clientesRoutes from "./routes/clientesRoutes.js";
import ordenesRoutes from "./routes/ordenesRoutes.js";
import serviciosRoutes from "./routes/serviciosRoutes.js";
import inventarioRoutes from "./routes/inventarioRoutes.js";
import empleadosRoutes from "./routes/empleadosRoutes.js";
import cajaRoutes from "./routes/cajaRoutes.js";


const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", authRoutes);
app.use("/api/password-reset", passwordResetRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", clientesRoutes);
app.use("/api", ordenesRoutes);
app.use("/api", serviciosRoutes);
app.use("/api", inventarioRoutes);
app.use("/api", empleadosRoutes);
app.use("/api", cajaRoutes);

app.get("/", (req, res) => {
  res.send("API funcionando");
});

export default app;