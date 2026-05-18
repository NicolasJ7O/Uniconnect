export type StudyGroupEvent = 
  | 'GROUP_CREATED'
  | 'GROUP_UPDATED'
  | 'GROUP_DELETED'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'RESOURCE_ADDED'
  | 'JOIN_REQUEST_CREATED'
  | 'JOIN_REQUEST_ACCEPTED'
  | 'JOIN_REQUEST_REJECTED'
  | 'JOIN_REQUESTED'
  | 'OWNERSHIP_TRANSFERRED'
  | 'OWNERSHIP_TRANSFER_REQUESTED';

export interface Observer {
  update(event: StudyGroupEvent, data: any): Promise<void>;
}

export interface Subject {
  attach(observer: Observer): void;
  detach(observer: Observer): void;
  notify(event: StudyGroupEvent, data: any): Promise<void>;
}

export class StudyGroupSubject implements Subject {
  private observers: Observer[] = [];
  private static instance: StudyGroupSubject;

  private constructor() {}

  public static getInstance(): StudyGroupSubject {
    if (!StudyGroupSubject.instance) {
      StudyGroupSubject.instance = new StudyGroupSubject();
    }
    return StudyGroupSubject.instance;
  }

  attach(observer: Observer): void {
    const isExist = this.observers.includes(observer);
    if (isExist) {
      return;
    }
    this.observers.push(observer);
  }

  detach(observer: Observer): void {
    const observerIndex = this.observers.indexOf(observer);
    if (observerIndex === -1) {
      return;
    }
    this.observers.splice(observerIndex, 1);
  }

  async notify(event: StudyGroupEvent, data: any): Promise<void> {
    for (const observer of this.observers) {
      await observer.update(event, data);
    }
  }
}
