export type EventoUniversidadEvent = 'NUEVO_EVENTO';

export interface ISubject {
  attach(observer: IObserver): void;
  detach(observer: IObserver): void;
  notify(event: EventoUniversidadEvent, data: any): Promise<void>;
}

export interface IObserver {
  update(event: EventoUniversidadEvent, data: any): Promise<void>;
}

export class EventoUniversidadSubject implements ISubject {
  private observers: IObserver[] = [];
  private static instance: EventoUniversidadSubject;

  private constructor() {}

  public static getInstance(): EventoUniversidadSubject {
    if (!EventoUniversidadSubject.instance) {
      EventoUniversidadSubject.instance = new EventoUniversidadSubject();
    }
    return EventoUniversidadSubject.instance;
  }

  attach(observer: IObserver): void {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
    }
  }

  detach(observer: IObserver): void {
    const idx = this.observers.indexOf(observer);
    if (idx !== -1) {
      this.observers.splice(idx, 1);
    }
  }

  async notify(event: EventoUniversidadEvent, data: any): Promise<void> {
    for (const observer of this.observers) {
      await observer.update(event, data);
    }
  }
}
