import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../utils/db';
import { AppError } from '../middleware/errorHandler';

// Helper class for creating AppError instances
class AppErrorClass extends Error implements AppError {
  statusCode?: number;
  code?: string;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// Email password recovery schemas removed

// Helper function to generate JWT token
const generateToken = (userId: string, username: string): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppErrorClass('JWT secret not configured', 500);
  }

  return jwt.sign(
    { userId, username },
    jwtSecret as jwt.Secret,
    {
      expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'],
    }
  );
};

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res, next) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { username, password } = validatedData;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      throw new AppErrorClass('Username already exists', 400);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user，默认状态为 active
    const user = await prisma.user.create({
      data: {
        username,
        password: passwordHash,
        nickname: username,
        status: 'active',
      },
      select: {
        id: true,
        username: true,
        nickname: true,
        avatarUrl: true,
        level: true,
        experience: true,
        createdAt: true,
        status: true,
      },
    });

    // Generate token
    const token = generateToken(user.id, user.username);

    logger.info(`User registered: ${username}`);

    res.status(201).json({
      code: 201,
      message: 'User registered successfully',
      data: {
        token,
        user,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppErrorClass('Invalid input data', 400));
    } else {
      next(error);
    }
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res, next) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { username, password } = validatedData;

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new AppErrorClass('Invalid username or password', 401);
    }

    if (user.status === 'frozen') {
      throw new AppErrorClass('Account is frozen, please contact administrator', 403);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new AppErrorClass('Invalid username or password', 401);
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate token
    const token = generateToken(user.id, user.username);

    logger.info(`User logged in: ${username}`);

    res.json({
      code: 200,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
          level: user.level,
          experience: user.experience,
          status: user.status,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppErrorClass('Invalid input data', 400));
    } else {
      next(error);
    }
  }
});

// Forgot/Reset password endpoints removed

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const username = req.username!;

    // Generate new token
    const token = generateToken(userId, username);

    res.json({
      code: 200,
      message: 'Token refreshed successfully',
      data: { token },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

