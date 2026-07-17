// ── Load .env file BEFORE validating environment ──
import 'dotenv/config';

// ── ENVIRONMENT VALIDATION: Fail fast on missing required vars ──
import './lib/env';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { createId } from '@paralleldrive/cuid2';

import { logger } from './lib/logger';
import studentRoutes from './modules/students/student.routes';
import teacherRoutes from './modules/teachers/teacher.routes';
import staffRoutes from './modules/staff/staff.routes';
import timetableRoutes from './modules/timetable/timetable.routes';
import financeRoutes from './modules/finance/finance.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import gradesRoutes from './modules/grades/grades.routes';

// ── Auth ──
import authRoutes from './modules/auth/auth.routes';
import { authenticate } from './middleware/auth.middleware';

// ── Security ──
import { sanitizeInput } from './middleware/xss.middleware';

// ── Audit ──
import { auditLog } from './middleware/audit.middleware';

// ── Error handler ──
import { globalErrorHandler } from './middleware/error.handler';

const app = express();
const port = process.env.PORT || 5000;

// ── SECURITY: HTTP security headers ──
app.use(helmet());

// ── OBSERVABILITY: Structured request logging + Request ID ──
app.use(pinoHttp({
  logger,
  genReqId: () => createId() as string,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
}));

// Expose request ID in response header for client-side tracing
app.use((req, res, next) => {
  if (req.id) {
    res.setHeader('X-Request-Id', String(req.id));
  }
  next();
});

// ── AUDIT: Log all write operations to database ──
app.use(auditLog);

// ── CORS — env-driven ──
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200
}));

// ── GLOBAL MIDDLEWARE ──
app.use(express.json());

// ── XSS SANITIZATION: Strip HTML from all string inputs ──
app.use(sanitizeInput);

// ── RATE LIMITING on all /api/ routes ──
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: {
    success: false,
    message: 'Too many requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// ═══════════════════════════════════════════
// ── PUBLIC ROUTES (no JWT required) ──
// ═══════════════════════════════════════════

// Health check — for load balancers and monitoring
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    }
  });
});

// Auth — login endpoint (has its own stricter rate limiter)
app.use('/api/auth', authRoutes);

// ═══════════════════════════════════════════
// ── PROTECTED ROUTES (JWT required) ──
// ═══════════════════════════════════════════

app.use('/api/students', authenticate, studentRoutes);
app.use('/api/teachers', authenticate, teacherRoutes);
app.use('/api/staff', authenticate, staffRoutes);
app.use('/api/timetable', authenticate, timetableRoutes);
app.use('/api/finance', authenticate, financeRoutes);
app.use('/api/grades', authenticate, gradesRoutes);
app.use('/api/attendance', authenticate, attendanceRoutes);

// ── 404 HANDLER (Must come AFTER all valid routes) ──
app.use((_req, res) => {
  res.status(404).json({ success: false, message: `Resource ${_req.originalUrl} not found.` });
});

// ── GLOBAL ERROR HANDLER (Must ALWAYS be the very last middleware) ──
app.use(globalErrorHandler);

app.listen(port, () => {
  logger.info({ port }, '[SMS-Core-Backend] Pipeline online.');
});

export default app;
