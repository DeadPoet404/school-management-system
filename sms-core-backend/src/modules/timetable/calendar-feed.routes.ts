/**
 * SMS-010 -- PUBLIC per-class .ics feed.
 *
 * This router is mounted in app.ts BEFORE the authenticated /api/timetable
 * mount on purpose: calendar applications (Google Calendar et al.) cannot
 * carry our JWT cookies, so the stateless HMAC token in ?token= IS the
 * credential. The global apiLimiter still applies to this path. Feeds are
 * read-only by construction.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '@/middleware/error.handler';
import { verifyFeedToken, buildIcsFeed } from '@/lib/calendar';
import { TimetableService } from './timetable.service';

const router = Router();
const timetableService = new TimetableService();

router.get('/:classId.ics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = process.env.CALENDAR_FEED_SECRET;
    if (!secret) throw new AppError(503, 'Calendar feeds are disabled: CALENDAR_FEED_SECRET is not configured.');

    const classId = verifyFeedToken(String(req.query.token ?? ''), secret);
    if (!classId || classId !== req.params.classId) {
      throw new AppError(401, 'A valid feed token is required.');
    }

    const feed = await timetableService.getCalendarEventsForClass(classId);
    const ics = buildIcsFeed(feed);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // subscribers poll; Google lags hours anyway
    return res.send(ics);
  } catch (error) {
    next(error);
  }
});

export default router;
