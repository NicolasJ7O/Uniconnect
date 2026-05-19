import { StudyGroupSubject } from './study-group.subject.js';
import { NotificationObserver } from './notification.observer.js';
import { LoggerObserver } from './logger.observer.js';

// New Observer Pattern imports
import { GrupoEstudioSubject } from './grupo-estudio.subject.js';
import { WebSocketNotificationObserver } from './websocket-notification.observer.js';
import { PersistenciaNotificacionObserver } from './persistencia-notificacion.observer.js';

const studyGroupSubject = StudyGroupSubject.getInstance();

// Register base observers
studyGroupSubject.attach(new NotificationObserver());
studyGroupSubject.attach(new LoggerObserver());

// Automatically instantiate and register GrupoEstudio observers
const grupoEstudioSubject = GrupoEstudioSubject.getInstance();
grupoEstudioSubject.attach(new PersistenciaNotificacionObserver());
grupoEstudioSubject.attach(new WebSocketNotificationObserver());

export { studyGroupSubject, grupoEstudioSubject };
