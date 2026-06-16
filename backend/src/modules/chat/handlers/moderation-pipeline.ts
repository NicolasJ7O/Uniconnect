import { ModerationContext, ModerationResult } from './moderation.handler.js';
import { LongitudHandler } from './longitud.handler.js';
import { PalabrasProhibidasHandler } from './palabras-prohibidas.handler.js';
import { SpamHandler } from './spam.handler.js';
import { EnlacesExternosHandler } from './enlaces-externos.handler.js';
import { PersistenciaHandler } from './persistencia.handler.js';

export async function runModerationPipeline(ctx: ModerationContext): Promise<ModerationResult> {
  const longitud = new LongitudHandler();
  const palabrasProhibidas = new PalabrasProhibidasHandler();
  const spam = new SpamHandler();
  const enlacesExternos = new EnlacesExternosHandler();
  const persistencia = new PersistenciaHandler();

  // Order: LongitudHandler → PalabrasProhibidasHandler → SpamHandler → EnlacesExternosHandler → PersistenciaHandler
  longitud
    .setNext(palabrasProhibidas)
    .setNext(spam)
    .setNext(enlacesExternos)
    .setNext(persistencia);

  return longitud.handle(ctx);
}
