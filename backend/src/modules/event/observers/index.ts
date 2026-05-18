import { EventSubject } from './event.subject.js';
import { EventNotificationObserver } from './notification.observer.js';

const eventSubject = EventSubject.getInstance();
eventSubject.attach(new EventNotificationObserver());

export { eventSubject };
