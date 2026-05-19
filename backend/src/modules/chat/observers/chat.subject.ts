export type ChatEvent = 'NUEVO_MENSAJE';

export interface IChatObserver {
  update(event: ChatEvent, data: { isPrivate: boolean; message: any }): Promise<void>;
}

export interface IChatSubject {
  attach(observer: IChatObserver): void;
  detach(observer: IChatObserver): void;
  notify(event: ChatEvent, data: { isPrivate: boolean; message: any }): Promise<void>;
}

export class ChatSubject implements IChatSubject {
  private observers: IChatObserver[] = [];
  private static instance: ChatSubject;

  private constructor() {}

  public static getInstance(): ChatSubject {
    if (!ChatSubject.instance) {
      ChatSubject.instance = new ChatSubject();
    }
    return ChatSubject.instance;
  }

  attach(observer: IChatObserver): void {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
    }
  }

  detach(observer: IChatObserver): void {
    const idx = this.observers.indexOf(observer);
    if (idx !== -1) {
      this.observers.splice(idx, 1);
    }
  }

  async notify(event: ChatEvent, data: { isPrivate: boolean; message: any }): Promise<void> {
    for (const observer of this.observers) {
      await observer.update(event, data);
    }
  }
}
