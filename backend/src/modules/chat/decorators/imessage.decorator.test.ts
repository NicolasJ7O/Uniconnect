import test from 'node:test';
import assert from 'node:assert';
import {
  MensajeBase,
  MensajeConArchivo,
  MensajeConMencion,
  MensajeConReaccion
} from './imessage.decorator.js';

test('MensajeBase Tests', async (t) => {
  await t.test('Criterio 1: renders only plain text without additional metadata', () => {
    const timestamp = new Date();
    const message = new MensajeBase('hola estudiante', 'user-001', timestamp);
    const renderOutput = message.render();
    
    assert.strictEqual(renderOutput, '<p class="mensaje-texto">hola estudiante</p>');
    assert.ok(!renderOutput.includes('adjunto'));
    assert.ok(!renderOutput.includes('mention'));
    assert.ok(!renderOutput.includes('reaccion-badge'));
  });

  await t.test('correctly retrieves base content and metadata', () => {
    const timestamp = new Date();
    const message = new MensajeBase('hola estudiante', 'user-001', timestamp);
    
    assert.strictEqual(message.getContenido(), 'hola estudiante');
    const metadata = message.getMetadata();
    assert.strictEqual(metadata.userId, 'user-001');
    assert.strictEqual(metadata.timestamp, timestamp);
  });
});

test('MensajeConArchivo Tests', async (t) => {
  await t.test('Criterio 2: renders with attachment details', () => {
    const timestamp = new Date();
    const base = new MensajeBase('mira el pdf', 'user-001', timestamp);
    const docWithFile = new MensajeConArchivo(base, 'https://ucaldas.edu.co/uploads/temario.pdf', 'application/pdf', 2048);
    
    const renderOutput = docWithFile.render();
    assert.ok(renderOutput.includes('temario.pdf'));
    assert.ok(renderOutput.includes('2048 bytes'));
    assert.ok(renderOutput.includes('data-url="https://ucaldas.edu.co/uploads/temario.pdf"'));
    assert.ok(renderOutput.includes('data-type="application/pdf"'));
    assert.ok(renderOutput.includes('data-size="2048"'));
  });

  await t.test('metadata includes the attachment details', () => {
    const timestamp = new Date();
    const base = new MensajeBase('mira el pdf', 'user-001', timestamp);
    const docWithFile = new MensajeConArchivo(base, 'https://ucaldas.edu.co/uploads/temario.pdf', 'application/pdf', 2048);
    
    const metadata = docWithFile.getMetadata();
    assert.strictEqual(metadata.userId, 'user-001');
    assert.deepStrictEqual(metadata.file, {
      url: 'https://ucaldas.edu.co/uploads/temario.pdf',
      mimeType: 'application/pdf',
      tamano: 2048
    });
  });
});

test('MensajeConMencion Tests', async (t) => {
  await t.test('renders message with formatted mention spans', () => {
    const timestamp = new Date();
    const base = new MensajeBase('hola @user-002, como estas?', 'user-001', timestamp);
    const decorated = new MensajeConMencion(base, ['user-002']);
    
    const renderOutput = decorated.render();
    assert.strictEqual(renderOutput, '<p class="mensaje-texto">hola <span class="mention">@user-002</span>, como estas?</p>');
  });

  await t.test('metadata includes mentioned users list', () => {
    const timestamp = new Date();
    const base = new MensajeBase('hola @user-002', 'user-001', timestamp);
    const decorated = new MensajeConMencion(base, ['user-002']);
    
    const metadata = decorated.getMetadata();
    assert.deepStrictEqual(metadata.mentions, ['user-002']);
  });
});

test('MensajeConReaccion Tests', async (t) => {
  await t.test('renders HTML reactions badges when they exist', () => {
    const timestamp = new Date();
    const base = new MensajeBase('buena publicacion', 'user-001', timestamp);
    const decorated = new MensajeConReaccion(base, [
      { emoji: '👍', count: 1, users: ['user-002'] }
    ]);
    
    const renderOutput = decorated.render();
    assert.ok(renderOutput.includes('reaccion-badge'));
    assert.ok(renderOutput.includes('👍 1'));
  });

  await t.test('reacting multiple times behaves properly in metadata', () => {
    const timestamp = new Date();
    const base = new MensajeBase('buena publicacion', 'user-001', timestamp);
    const decorated = new MensajeConReaccion(base);
    
    decorated.agregarReaccion('🎉', 'user-002');
    decorated.agregarReaccion('🎉', 'user-003');
    decorated.agregarReaccion('🎉', 'user-002'); // Duplicate reaction from same user should be ignored
    
    const metadata = decorated.getMetadata();
    assert.deepStrictEqual(metadata.reacciones, [
      { emoji: '🎉', count: 2, users: ['user-002', 'user-003'] }
    ]);
  });
});

test('Composition and Negative Tests', async (t) => {
  await t.test('Criterio 3: composed decorators render attachment and mentions simultaneously', () => {
    const timestamp = new Date();
    const base = new MensajeBase('hola @user-002 adjunto el pdf', 'user-001', timestamp);
    const withFile = new MensajeConArchivo(base, 'https://ucaldas.edu.co/doc.pdf', 'application/pdf', 500);
    const withMention = new MensajeConMencion(withFile, ['user-002']);
    
    const renderOutput = withMention.render();
    // Render holds both parts
    assert.ok(renderOutput.includes('<span class="mention">@user-002</span>'));
    assert.ok(renderOutput.includes('doc.pdf'));
    assert.ok(renderOutput.includes('500 bytes'));

    // Metadata holds both parts
    const metadata = withMention.getMetadata();
    assert.strictEqual(metadata.userId, 'user-001');
    assert.deepStrictEqual(metadata.mentions, ['user-002']);
    assert.deepStrictEqual(metadata.file, {
      url: 'https://ucaldas.edu.co/doc.pdf',
      mimeType: 'application/pdf',
      tamano: 500
    });
  });

  await t.test('Criterio 4: negative test - message without file decorator does not contain file field in metadata or render', () => {
    const timestamp = new Date();
    const base = new MensajeBase('solo un mensaje', 'user-001', timestamp);
    const withMention = new MensajeConMencion(base, ['user-002']);
    
    const renderOutput = withMention.render();
    assert.ok(!renderOutput.includes('adjunto'));
    assert.ok(!renderOutput.includes('📎'));
    
    const metadata = withMention.getMetadata();
    assert.strictEqual(metadata.file, undefined);
  });
});
