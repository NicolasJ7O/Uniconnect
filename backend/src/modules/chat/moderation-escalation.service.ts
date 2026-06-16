import { prisma } from '../../lib/prisma.js';
import { emitToUser } from '../../lib/socket.js';
import { Logger } from '../../lib/logger.js';

const logger = Logger.getInstance();

const ESCALATION_THRESHOLD = 3; // number of blocks before escalating to super_admin

/**
 * Sends an escalation alert to the N8N webhook and to all online super_admin users
 * via WebSocket. Called fire-and-forget from ChatService.
 *
 * After escalation, resets the blockCount so the clock restarts.
 */
export async function checkAndEscalate(userId: string): Promise<void> {
  try {
    const block = await prisma.userBlock.findUnique({ where: { userId } });
    if (!block) return;

    if (block.blockCount >= ESCALATION_THRESHOLD) {
      // Fetch offending user for context
      const offender = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true }
      });

      if (!offender) return;

      logger.warn('Moderación: escalamiento a super_admin', {
        userId,
        blockCount: block.blockCount,
        blockedUntil: block.blockedUntil
      });

      // 1. Trigger N8N webhook (fire & forget, does NOT throw)
      await triggerEscalationWebhook(offender, block.blockCount);

      // 2. Notify all super_admin users via WebSocket
      await notifySuperAdmins(offender, block.blockCount);

      // 3. Reset blockCount so the cycle restarts
      await prisma.userBlock.update({
        where: { userId },
        data: { blockCount: 0 }
      });
    }
  } catch (error) {
    // Never crash the message flow due to escalation errors
    logger.error('Error en checkAndEscalate', {
      userId,
      error: error instanceof Error ? error.message : error
    });
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function triggerEscalationWebhook(
  offender: { id: string; name: string | null; email: string },
  blockCount: number
): Promise<void> {
  const webhookUrl =
    process.env.N8N_MODERATION_WEBHOOK_URL ||
    process.env.N8N_WEBHOOK_URL ||
    process.env.N8N_US_N8N03_URL;

  if (!webhookUrl) {
    logger.warn('N8N webhook no configurado; omitiendo alerta de escalamiento', {
      userId: offender.id
    });
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'moderacion.escalamiento',
        userId: offender.id,
        userName: offender.name || 'Usuario desconocido',
        email: offender.email,
        blockCount,
        severity: 'high',
        timestamp: new Date().toISOString(),
        message: `El usuario ${offender.name || offender.email} ha acumulado ${blockCount} bloqueos por spam y requiere revisión administrativa.`
      })
    });

    if (!response.ok) {
      logger.warn(`N8N webhook devolvió ${response.status} para escalamiento`, {
        userId: offender.id
      });
    } else {
      logger.info('Alerta de escalamiento enviada a N8N', { userId: offender.id, blockCount });
    }
  } catch (error) {
    logger.error('Error al disparar webhook de escalamiento en N8N', {
      userId: offender.id,
      error: error instanceof Error ? error.message : error
    });
  }
}

async function notifySuperAdmins(
  offender: { id: string; name: string | null; email: string },
  blockCount: number
): Promise<void> {
  try {
    // Find all super_admin users
    const superAdmins = await prisma.user.findMany({
      where: { role: 'super_admin' },
      select: { id: true }
    });

    if (superAdmins.length === 0) {
      logger.warn('No hay usuarios super_admin para notificar');
      return;
    }

    const alertPayload = {
      kind: 'moderacion.escalamiento',
      userId: offender.id,
      userName: offender.name || 'Usuario desconocido',
      email: offender.email,
      blockCount,
      severity: 'high',
      timestamp: new Date().toISOString(),
      message: `⚠️ El usuario "${offender.name || offender.email}" ha sido bloqueado ${blockCount} veces por spam. Se requiere revisión.`
    };

    for (const admin of superAdmins) {
      emitToUser(admin.id, 'super-admin-alert', alertPayload);
    }

    logger.info('Alerta super_admin emitida vía WebSocket', {
      adminCount: superAdmins.length,
      offenderId: offender.id
    });
  } catch (error) {
    logger.error('Error al notificar super_admin por WebSocket', {
      offenderId: offender.id,
      error: error instanceof Error ? error.message : error
    });
  }
}
