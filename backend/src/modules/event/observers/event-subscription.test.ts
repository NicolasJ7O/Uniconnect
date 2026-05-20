import test from 'node:test';
import assert from 'node:assert';
import {
  EventoUniversidadSubject,
  type IObserver,
  type EventoUniversidadEvent
} from './event.subject.js';

class MockObserver implements IObserver {
  public receivedNotifications: Array<{ event: EventoUniversidadEvent; data: any }> = [];

  async update(event: EventoUniversidadEvent, data: any): Promise<void> {
    this.receivedNotifications.push({ event, data });
  }
}

test('EventoUniversidadSubject & Observer Pattern Tests', async (t) => {
  await t.test('Criterio 1: EventoUniversidadSubject implements ISubject and sends NUEVO_EVENTO with category', async () => {
    const subject = EventoUniversidadSubject.getInstance();
    const observer = new MockObserver();
    
    subject.attach(observer);
    
    const eventPayload = {
      eventId: 'event-id-999',
      title: 'Seminario de Inteligencia Artificial',
      category: 'ACADEMICO',
      organizerName: 'Profesor Carlos'
    };
    
    await subject.notify('NUEVO_EVENTO', eventPayload);
    
    // Validate observer received it
    assert.strictEqual(observer.receivedNotifications.length, 1);
    const notification = observer.receivedNotifications[0];
    
    assert.strictEqual(notification.event, 'NUEVO_EVENTO');
    assert.strictEqual(notification.data.eventId, 'event-id-999');
    assert.strictEqual(notification.data.title, 'Seminario de Inteligencia Artificial');
    assert.strictEqual(notification.data.category, 'ACADEMICO'); // Category is included in the payload
    assert.strictEqual(notification.data.organizerName, 'Profesor Carlos');
    
    // Detach to keep environment clean
    subject.detach(observer);
  });

  await t.test('Multiple observers receive events simultaneously', async () => {
    const subject = EventoUniversidadSubject.getInstance();
    const observerA = new MockObserver();
    const observerB = new MockObserver();
    
    subject.attach(observerA);
    subject.attach(observerB);
    
    const eventPayload = {
      eventId: 'event-id-111',
      title: 'Tarde Deportiva',
      category: 'DEPORTIVO',
      organizerName: 'Nicolas'
    };
    
    await subject.notify('NUEVO_EVENTO', eventPayload);
    
    assert.strictEqual(observerA.receivedNotifications.length, 1);
    assert.strictEqual(observerB.receivedNotifications.length, 1);
    
    assert.strictEqual(observerA.receivedNotifications[0].data.category, 'DEPORTIVO');
    assert.strictEqual(observerB.receivedNotifications[0].data.category, 'DEPORTIVO');
    
    subject.detach(observerA);
    subject.detach(observerB);
  });

  await t.test('Observer does not receive events after detaching', async () => {
    const subject = EventoUniversidadSubject.getInstance();
    const observer = new MockObserver();
    
    subject.attach(observer);
    subject.detach(observer);
    
    const eventPayload = {
      eventId: 'event-id-222',
      title: 'Concierto de Rock',
      category: 'CULTURAL',
      organizerName: 'Banda U'
    };
    
    await subject.notify('NUEVO_EVENTO', eventPayload);
    
    assert.strictEqual(observer.receivedNotifications.length, 0);
  });
});
