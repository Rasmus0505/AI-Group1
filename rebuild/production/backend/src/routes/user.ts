import express from 'express';
import { z } from 'zod';
import prisma from '../utils/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/avatars/',
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Validation schemas
const updateUserInfoSchema = z.object({
  nickname: z.string().min(1).max(50).optional(),
});

/**
 * GET /api/user/info
 * Get current user information
 */
router.get('/info', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        nickname: true,
        avatarUrl: true,
        level: true,
        experience: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new AppErrorClass('User not found', 404);
    }

    res.json({
      code: 200,
      message: 'User information retrieved successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/user/info
 * Update user information
 */
router.put('/info', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const validatedData = updateUserInfoSchema.parse(req.body);

    // Email update logic removed

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: validatedData,
      select: {
        id: true,
        username: true,
        nickname: true,
        avatarUrl: true,
        level: true,
        experience: true,
      },
    });

    logger.info(`User info updated: ${userId}`);

    res.json({
      code: 200,
      message: 'User information updated successfully',
      data: updatedUser,
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
 * POST /api/user/avatar
 * Upload user avatar
 */
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;

    if (!req.file) {
      throw new AppErrorClass('No file uploaded', 400);
    }

    // Generate unique filename
    const fileExt = path.extname(req.file.originalname);
    const filename = `${userId}-${Date.now()}${fileExt}`;
    const filepath = path.join('uploads/avatars', filename);

    // Move file to permanent location
    fs.renameSync(req.file.path, filepath);

    // Generate avatar URL (in production, use cloud storage URL)
    const avatarUrl = `/uploads/avatars/${filename}`;

    // Update user avatar
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // Delete old avatar if exists
    if (user?.avatarUrl) {
      const oldPath = path.join(process.cwd(), user.avatarUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        username: true,
        nickname: true,
        avatarUrl: true,
        level: true,
        experience: true,
      },
    });

    logger.info(`Avatar uploaded for user: ${userId}`);

    res.json({
      code: 200,
      message: 'Avatar uploaded successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

