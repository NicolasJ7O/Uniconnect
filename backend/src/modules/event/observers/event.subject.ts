export type EventEvent = 'EVENT_CREATED';

export interface EventObserver {
  update(event: EventEvent, data: any): Promise<void>;
}

export interface EventSubjectInterface {
  attach(observer: EventObserver): void;
  detach(observer: EventObserver): void;
  notify(event: EventEvent, data: any): Promise<void>;
}

export class EventSubject implements EventSubjectInterface {
  private observers: EventObserver[] = [];
  private static instance: EventSubject;

  private constructor() {}

  public static getInstance(): EventSubject {
    if (!EventSubject.instance) {
      EventSubject.instance = new EventSubject();
    }
    return EventSubject.instance;
  }

  attach(observer: EventObserver): void {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
    }
  }

  detach(observer: EventObserver): void {
    const idx = this.observers.indexOf(observer);
    if (idx !== -1) this.observers.splice(idx, 1);
  }

  async notify(event: EventEvent, data: any): Promise<void> {
    for (const observer of this.observers) {
      await observer.update(event, data);
    }
  }
}
