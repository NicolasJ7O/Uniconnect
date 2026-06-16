import type { NextFunction, Request, Response } from 'express';
import { Logger } from '../../lib/logger.js';

const logger = Logger.getInstance();

function normalizeRole(role?: string) {
  return (role || 'student').toLowerCase();
}

export function requireRoles(...allowedRoles: string[]) {
  const requiredRoles = allowedRoles.map((role) => role.toLowerCase());

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.sub) {
      logger.warn('Acceso administrativo denegado por token ausente', {
        endpoint: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
      });
      return res.status(401).json({ message: 'No autenticado' });
    }

    const currentRole = normalizeRole(req.user.role);
    const isAllowed = requiredRoles.length === 0 || requiredRoles.includes(currentRole);

    if (!isAllowed) {
      logger.warn('Acceso restringido a super_admin', {
        userId: req.user.sub,
        endpoint: req.originalUrl,
        method: req.method,
        currentRole,
        requiredRoles,
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({ message: 'Acceso restringido a super_admin' });
    }

    logger.info('Acceso administrativo autorizado', {
      userId: req.user.sub,
      role: currentRole,
      endpoint: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    next();
  };
}

export const requireSuperAdmin = requireRoles('super_admin');
