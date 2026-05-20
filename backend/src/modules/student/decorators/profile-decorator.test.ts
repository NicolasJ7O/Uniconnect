import test from 'node:test';
import assert from 'node:assert';
import {
  PerfilBase,
  PerfilConEstadisticas,
  PerfilConInsignias,
  type StudentStats
} from './profile.decorator.js';

test('PerfilBase Tests', async (t) => {
  await t.test('correctly serializes base profile information to JSON', () => {
    const base = new PerfilBase(
      'student-001',
      'Nicolas',
      'nicolas@ucaldas.edu.co',
      'https://ucaldas.edu.co/avatar.jpg',
      'Sistemas',
      6,
      [{ id: 'sub-01', name: 'Calculo' }]
    );
    
    const json = base.toJSON();
    assert.strictEqual(json.id, 'student-001');
    assert.strictEqual(json.name, 'Nicolas');
    assert.strictEqual(json.email, 'nicolas@ucaldas.edu.co');
    assert.strictEqual(json.avatarUrl, 'https://ucaldas.edu.co/avatar.jpg');
    assert.strictEqual(json.career, 'Sistemas');
    assert.strictEqual(json.currentSemester, 6);
    assert.deepStrictEqual(json.subjects, [{ id: 'sub-01', name: 'Calculo' }]);
  });

  await t.test('handles nullable fields gracefully during serialization', () => {
    const base = new PerfilBase(
      'student-002',
      'Juan',
      'juan@ucaldas.edu.co',
      null,
      null,
      null,
      []
    );
    
    const json = base.toJSON();
    assert.strictEqual(json.avatarUrl, null);
    assert.strictEqual(json.career, null);
    assert.strictEqual(json.currentSemester, null);
    assert.deepStrictEqual(json.subjects, []);
  });
});

test('PerfilConEstadisticas Tests', async (t) => {
  const baseProfile = new PerfilBase(
    'student-001',
    'Nicolas',
    'nicolas@ucaldas.edu.co',
    null,
    'Sistemas',
    6,
    []
  );

  const stats: StudentStats = {
    gruposCreados: 3,
    gruposParticipa: 5,
    mensajesEnviados: 120
  };

  await t.test('adds statistics payload while preserving base fields', () => {
    const decorated = new PerfilConEstadisticas(baseProfile, stats);
    const json = decorated.toJSON();
    
    assert.strictEqual(json.id, 'student-001');
    assert.strictEqual(json.name, 'Nicolas');
    assert.deepStrictEqual(json.stats, stats);
  });

  await t.test('reflects real-time changes in statistics configuration', () => {
    const customStats: StudentStats = {
      gruposCreados: 0,
      gruposParticipa: 1,
      mensajesEnviados: 5
    };
    const decorated = new PerfilConEstadisticas(baseProfile, customStats);
    const json = decorated.toJSON();
    
    assert.strictEqual(json.stats.gruposCreados, 0);
    assert.strictEqual(json.stats.mensajesEnviados, 5);
  });
});

test('PerfilConInsignias Tests', async (t) => {
  const baseProfile = new PerfilBase(
    'student-001',
    'Nicolas',
    'nicolas@ucaldas.edu.co',
    null,
    'Sistemas',
    6,
    []
  );

  await t.test('decorates profile with badges array', () => {
    const badges = ['LIDER_GRUPO', 'COLABORADOR_ACTIVO'];
    const decorated = new PerfilConInsignias(baseProfile, badges);
    const json = decorated.toJSON();
    
    assert.strictEqual(json.name, 'Nicolas');
    assert.deepStrictEqual(json.insignias, badges);
  });

  await t.test('handles empty badges array properly', () => {
    const decorated = new PerfilConInsignias(baseProfile, []);
    const json = decorated.toJSON();
    
    assert.deepStrictEqual(json.insignias, []);
  });
});

test('Profile Decorators Composition Tests', async (t) => {
  const baseProfile = new PerfilBase(
    'student-001',
    'Nicolas',
    'nicolas@ucaldas.edu.co',
    null,
    'Sistemas',
    6,
    []
  );

  const stats: StudentStats = {
    gruposCreados: 2,
    gruposParticipa: 4,
    mensajesEnviados: 45
  };

  const badges = ['LOGRO_PLATINO'];

  await t.test('correctly composes statistics and badges together', () => {
    const withStats = new PerfilConEstadisticas(baseProfile, stats);
    const withStatsAndBadges = new PerfilConInsignias(withStats, badges);
    
    const json = withStatsAndBadges.toJSON();
    assert.strictEqual(json.id, 'student-001');
    assert.deepStrictEqual(json.stats, stats);
    assert.deepStrictEqual(json.insignias, badges);
  });

  await t.test('negative test: base profile alone does not leak stats or insignias', () => {
    const json = baseProfile.toJSON();
    assert.strictEqual(json.stats, undefined);
    assert.strictEqual(json.insignias, undefined);
  });
});
