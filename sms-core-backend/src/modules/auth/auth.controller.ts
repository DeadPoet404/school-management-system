import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '@/middleware/error.handler';
import { AuthService } from './auth.service';

const loginSchema = z.object({
  email: z.string().email('A valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

export class AuthController {
  private authService = new AuthService();

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0].message);
      }

      const { email, password } = parsed.data;
      const result = await this.authService.login(email, password);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
