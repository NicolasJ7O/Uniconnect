import { EventoUniversidadSubject } from './event.subject.js';
import { EventoNotificationObserver } from './notification.observer.js';

const eventSubject = EventoUniversidadSubject.getInstance();
eventSubject.attach(new EventoNotificationObserver());

export { eventSubject };
