import express from 'express';
import cors from 'cors';
import studentRoutes from './modules/students/student.routes';
import teacherRoutes from "./modules/teachers/teacher.routes";
import staffRoutes from "./modules/staff/staff.routes";
import timetableRoutes from "./modules/timetable/timetable.routes";
import financeRoutes from "./modules/finance/finance.routes";

// ── NEW: Import the error handler ──
import { globalErrorHandler } from './middleware/error.handler';

const app = express();
const port = process.env.PORT || 5000;

// --- CROSS-ORIGIN RESOURCE SHARING (CORS) ARCHITECTURE ---
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200
}));

// --- GLOBAL MIDDLEWARE ROUTER ENGINE ---
app.use(express.json());

// --- CORE SYSTEM APP ROUTE AGGREGATION PATTERNS ---
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/finance', financeRoutes);

// --- 404 HANDLER (Must come AFTER all valid routes) ---
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: `Resource footprint ${req.originalUrl} not discovered.` });
});

// ── NEW: Global Error Handler (Must ALWAYS be the very last middleware) ──
app.use(globalErrorHandler);

app.listen(port, () => {
  console.log(`[SMS-Core-Backend] Pipeline online. Listening on port ${port}`);
});

export default app;