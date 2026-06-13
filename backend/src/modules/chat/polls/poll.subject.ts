export type PollEvent = 'ENCUESTA_ACTUALIZADA' | 'ENCUESTA_CERRADA';

export interface IPollObserver {
  update(event: PollEvent, data: { groupId: string; poll: any }): Promise<void>;
}

export interface IPollSubject {
  attach(observer: IPollObserver): void;
  detach(observer: IPollObserver): void;
  notify(event: PollEvent, data: { groupId: string; poll: any }): Promise<void>;
}

export class PollSubject implements IPollSubject {
  private observers: IPollObserver[] = [];
  private static instance: PollSubject;

  private constructor() {}

  public static getInstance(): PollSubject {
    if (!PollSubject.instance) {
      PollSubject.instance = new PollSubject();
    }
    return PollSubject.instance;
  }

  attach(observer: IPollObserver): void {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
    }
  }

  detach(observer: IPollObserver): void {
    const index = this.observers.indexOf(observer);
    if (index !== -1) {
      this.observers.splice(index, 1);
    }
  }

  async notify(event: PollEvent, data: { groupId: string; poll: any }): Promise<void> {
    for (const observer of this.observers) {
      await observer.update(event, data);
    }
  }
}
