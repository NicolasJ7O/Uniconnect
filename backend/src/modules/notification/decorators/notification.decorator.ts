export interface ISystemNotification {
  getMensaje(): string;
  getDestinatario(): string;
  getTimestamp(): Date;
  toJSON(): Record<string, any>;
}

export class NotificacionBase implements ISystemNotification {
  constructor(
    private mensaje: string,
    private destinatario: string,
    private timestamp: Date = new Date()
  ) {}

  getMensaje(): string {
    return this.mensaje;
  }

  getDestinatario(): string {
    return this.destinatario;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  toJSON(): Record<string, any> {
    return {
      mensaje: this.mensaje,
      destinatario: this.destinatario,
      timestamp: this.timestamp,
    };
  }
}

export abstract class NotificacionDecorator implements ISystemNotification {
  constructor(protected notification: ISystemNotification) {}

  getMensaje(): string {
    return this.notification.getMensaje();
  }

  getDestinatario(): string {
    return this.notification.getDestinatario();
  }

  getTimestamp(): Date {
    return this.notification.getTimestamp();
  }

  toJSON(): Record<string, any> {
    return this.notification.toJSON();
  }
}

export type PrioridadNivel = 'normal' | 'urgente' | 'critica';

export class NotificacionConPrioridad extends NotificacionDecorator {
  constructor(
    notification: ISystemNotification,
    private nivel: PrioridadNivel
  ) {
    super(notification);
  }

  getNivel(): PrioridadNivel {
    return this.nivel;
  }

  override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      nivel: this.nivel,
    };
  }
}

export interface AccionNotificacion {
  label: string;
  endpoint: string;
}

export class NotificacionConAccion extends NotificacionDecorator {
  constructor(
    notification: ISystemNotification,
    private accion: AccionNotificacion
  ) {
    super(notification);
  }

  getAccion(): AccionNotificacion {
    return this.accion;
  }

  override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      accion: this.accion,
    };
  }
}
