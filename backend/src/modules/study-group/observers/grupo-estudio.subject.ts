export type GrupoEstudioEvent =
  | 'SOLICITUD_INGRESO'
  | 'MIEMBRO_ACEPTADO'
  | 'MIEMBRO_RECHAZADO'
  | 'TRANSFERENCIA_ADMIN_SOLICITADA'
  | 'TRANSFERENCIA_ADMIN_ACEPTADA';

export interface IObserver {
  update(event: GrupoEstudioEvent, data: any): Promise<void>;
}

export interface ISubject {
  attach(observer: IObserver): void;
  detach(observer: IObserver): void;
  notify(event: GrupoEstudioEvent, data: any): Promise<void>;
}

export class GrupoEstudioSubject implements ISubject {
  private observers: IObserver[] = [];
  private static instance: GrupoEstudioSubject;

  private constructor() {}

  public static getInstance(): GrupoEstudioSubject {
    if (!GrupoEstudioSubject.instance) {
      GrupoEstudioSubject.instance = new GrupoEstudioSubject();
    }
    return GrupoEstudioSubject.instance;
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

  async notify(event: GrupoEstudioEvent, data: any): Promise<void> {
    for (const observer of this.observers) {
      await observer.update(event, data);
    }
  }
}
