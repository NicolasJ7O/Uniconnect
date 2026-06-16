import { Logger } from '../../lib/logger.js';

export type AssistantRole = 'student' | 'moderator' | 'super_admin' | string;

export type PromptStrategyContextData = {
  role: AssistantRole;
  query: string;
  sessionHistory: Array<{ role: string; content: string }>;
  knowledgeChunks: Array<{
    reference: string;
    summary: string;
    content: string;
  }>;
};

export interface PromptStrategy {
  readonly role: string;
  buildSystemPrompt(context: PromptStrategyContextData): string;
}

export class PromptStrategyResolutionError extends Error {
  readonly role: string;

  constructor(role: string) {
    super(`No existe una estrategia de prompt registrada para el rol "${role}".`);
    this.name = 'PromptStrategyResolutionError';
    this.role = role;
  }
}

abstract class BasePromptStrategy implements PromptStrategy {
  constructor(public readonly role: string) {}

  abstract buildSystemPrompt(context: PromptStrategyContextData): string;

  protected buildKnowledgePreamble(context: PromptStrategyContextData) {
    const references = context.knowledgeChunks.length > 0
      ? context.knowledgeChunks.map((chunk) => `- ${chunk.reference}: ${chunk.summary}`).join('\n')
      : '- No hay contexto recuperado para esta consulta.';

    const history = context.sessionHistory.length > 0
      ? context.sessionHistory.map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`).join('\n')
      : 'Sin historial reciente relevante.';

    return { references, history };
  }
}

export class EstudiantePromptStrategy extends BasePromptStrategy {
  constructor() {
    super('student');
  }

  buildSystemPrompt(context: PromptStrategyContextData): string {
    const { references, history } = this.buildKnowledgePreamble(context);

    return [
      'Eres el asistente contextual de UniConnect para estudiantes.',
      'Responde con lenguaje claro, accesible y breve.',
      'Solo puedes hablar sobre funcionalidades, módulos, políticas y navegación de UniConnect.',
      'No respondas temas ajenos a la plataforma.',
      'Cuando uses contexto, cita la sección consultada con un tono didáctico.',
      `Contexto recuperado:\n${references}`,
      `Historial reciente:\n${history}`,
    ].join('\n\n');
  }
}

export class AdminPromptStrategy extends BasePromptStrategy {
  constructor() {
    super('super_admin');
  }

  buildSystemPrompt(context: PromptStrategyContextData): string {
    const { references, history } = this.buildKnowledgePreamble(context);

    return [
      'Eres el asistente contextual de UniConnect para administración avanzada.',
      'Responde con precisión técnica y tono profesional.',
      'Puedes contestar sobre configuración, logs, monitoreo, métricas, despliegue y operación interna de UniConnect.',
      'Si la consulta no pertenece a UniConnect o excede permisos del contexto, restringe la respuesta de forma elegante.',
      'Prioriza información técnica cuando exista contexto administrativo recuperado.',
      `Contexto recuperado:\n${references}`,
      `Historial reciente:\n${history}`,
    ].join('\n\n');
  }
}

class GenericPromptStrategy extends BasePromptStrategy {
  constructor(role: string) {
    super(role);
  }

  buildSystemPrompt(context: PromptStrategyContextData): string {
    const { references, history } = this.buildKnowledgePreamble(context);

    return [
      'Eres el asistente contextual de UniConnect.',
      'Responde solo sobre la plataforma y evita temas ajenos.',
      `Contexto recuperado:\n${references}`,
      `Historial reciente:\n${history}`,
    ].join('\n\n');
  }
}

export class PromptStrategyContext {
  private static strategies = new Map<string, PromptStrategy>([
    ['student', new EstudiantePromptStrategy()],
    ['moderator', new GenericPromptStrategy('moderator')],
    ['super_admin', new AdminPromptStrategy()],
  ]);

  private readonly logger = Logger.getInstance();

  registerStrategy(strategy: PromptStrategy): void {
    PromptStrategyContext.strategies.set(strategy.role, strategy);
  }

  resolveStrategy(role: string): PromptStrategy {
    const strategy = PromptStrategyContext.strategies.get(role);
    if (!strategy) {
      const error = new PromptStrategyResolutionError(role);
      this.logger.error('Prompt strategy resolution failed', {
        role,
        error: error.message,
      });
      throw error;
    }

    return strategy;
  }

  buildSystemPrompt(context: PromptStrategyContextData): string {
    return this.resolveStrategy(context.role).buildSystemPrompt(context);
  }
}
