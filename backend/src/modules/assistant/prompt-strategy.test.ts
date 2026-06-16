import test from 'node:test';
import assert from 'node:assert';
import {
  AdminPromptStrategy,
  EstudiantePromptStrategy,
  PromptStrategyContext,
  PromptStrategyResolutionError,
} from './prompt-strategy.js';

const sampleContext = {
  role: 'student',
  query: '¿Cómo funciona el dashboard?',
  sessionHistory: [
    { role: 'user', content: 'Hola' },
    { role: 'assistant', content: 'Hola, ¿en qué te ayudo?' },
  ],
  knowledgeChunks: [
    {
      reference: 'backend/src/modules/student/README.md · Decorator para perfiles',
      summary: 'Perfil base + estadísticas + insignias.',
      content: 'Contenido de ejemplo.',
    },
  ],
};

test('EstudiantePromptStrategy', async (t) => {
  await t.test('builds a student-oriented system prompt', () => {
    const strategy = new EstudiantePromptStrategy();
    const prompt = strategy.buildSystemPrompt(sampleContext);

    assert.ok(prompt.includes('asistente contextual de UniConnect para estudiantes'));
    assert.ok(prompt.includes('lenguaje claro, accesible y breve'));
    assert.ok(prompt.includes('Solo puedes hablar sobre funcionalidades, módulos, políticas y navegación de UniConnect'));
    assert.ok(prompt.includes('backend/src/modules/student/README.md'));
  });
});

test('AdminPromptStrategy', async (t) => {
  await t.test('builds a technical system prompt for super admins', () => {
    const strategy = new AdminPromptStrategy();
    const prompt = strategy.buildSystemPrompt({
      ...sampleContext,
      role: 'super_admin',
    });

    assert.ok(prompt.includes('asistente contextual de UniConnect para administración avanzada'));
    assert.ok(prompt.includes('configuración, logs, monitoreo, métricas'));
    assert.ok(prompt.includes('backend/src/modules/student/README.md'));
  });
});

test('PromptStrategyContext', async (t) => {
  await t.test('resolves registered strategies without mutating the service', () => {
    const context = new PromptStrategyContext();
    const strategy = context.resolveStrategy('student');

    assert.strictEqual(strategy.role, 'student');
    assert.ok(strategy.buildSystemPrompt(sampleContext).includes('estudiantes'));
  });

  await t.test('throws a controlled error and logs when the role is unknown', () => {
    const context = new PromptStrategyContext();
    const originalError = console.error;
    const logCalls: unknown[] = [];
    console.error = (...args: unknown[]) => {
      logCalls.push(args);
    };

    try {
      assert.throws(() => context.resolveStrategy('guest'), PromptStrategyResolutionError);
      assert.ok(logCalls.length > 0);
    } finally {
      console.error = originalError;
    }
  });
});
