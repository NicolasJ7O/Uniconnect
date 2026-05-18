export interface IMensaje {
  getContenido(): string;
  getMetadata(): Record<string, any>;
  render(): string;
}

export class MensajeBase implements IMensaje {
  constructor(
    private contenido: string,
    private userId: string,
    private timestamp: Date
  ) {}

  getContenido(): string {
    return this.contenido;
  }

  getMetadata(): Record<string, any> {
    return {
      userId: this.userId,
      timestamp: this.timestamp,
    };
  }

  render(): string {
    return `<p class="mensaje-texto">${this.contenido}</p>`;
  }
}

export abstract class MessageDecorator implements IMensaje {
  constructor(protected mensaje: IMensaje) {}

  getContenido(): string {
    return this.mensaje.getContenido();
  }

  getMetadata(): Record<string, any> {
    return this.mensaje.getMetadata();
  }

  render(): string {
    return this.mensaje.render();
  }
}

export class MensajeConArchivo extends MessageDecorator {
  constructor(
    mensaje: IMensaje,
    private url: string,
    private mimeType: string,
    private tamano: number
  ) {
    super(mensaje);
  }

  override getMetadata(): Record<string, any> {
    return {
      ...super.getMetadata(),
      file: {
        url: this.url,
        mimeType: this.mimeType,
        tamano: this.tamano,
      },
    };
  }

  override render(): string {
    const baseRender = super.render();
    const fileName = this.url.split('/').pop() || 'archivo';
    return `${baseRender}\n<div class="adjunto" data-url="${this.url}" data-type="${this.mimeType}" data-size="${this.tamano}">📎 ${fileName} (${this.tamano} bytes)</div>`;
  }
}

export class MensajeConMencion extends MessageDecorator {
  constructor(
    mensaje: IMensaje,
    private userIdsMencionados: string[]
  ) {
    super(mensaje);
  }

  override getMetadata(): Record<string, any> {
    return {
      ...super.getMetadata(),
      mentions: this.userIdsMencionados,
    };
  }

  override render(): string {
    let content = super.render();
    this.userIdsMencionados.forEach((uid) => {
      // Reemplaza menciones del tipo @userId o el ID directamente con un resaltado visual
      const regex = new RegExp(`@${uid}\\b`, 'g');
      content = content.replace(regex, `<span class="mention">@${uid}</span>`);
    });
    return content;
  }
}

export interface Reaccion {
  emoji: string;
  count: number;
  users: string[];
}

export class MensajeConReaccion extends MessageDecorator {
  private reacciones: Map<string, Reaccion> = new Map();

  constructor(
    mensaje: IMensaje,
    reaccionesIniciales?: Reaccion[]
  ) {
    super(mensaje);
    if (reaccionesIniciales) {
      reaccionesIniciales.forEach((r) => {
        this.reacciones.set(r.emoji, r);
      });
    }
  }

  agregarReaccion(emoji: string, userId: string): void {
    const existing = this.reacciones.get(emoji);
    if (existing) {
      if (!existing.users.includes(userId)) {
        existing.users.push(userId);
        existing.count += 1;
      }
    } else {
      this.reacciones.set(emoji, {
        emoji,
        count: 1,
        users: [userId],
      });
    }
  }

  override getMetadata(): Record<string, any> {
    const reactionsArray = Array.from(this.reacciones.values());
    return {
      ...super.getMetadata(),
      reacciones: reactionsArray,
    };
  }

  override render(): string {
    const baseRender = super.render();
    if (this.reacciones.size === 0) return baseRender;

    const reactionsHtml = Array.from(this.reacciones.values())
      .map(
        (r) =>
          `<span class="reaccion-badge" title="Usuarios: ${r.users.join(
            ', '
          )}">${r.emoji} ${r.count}</span>`
      )
      .join(' ');

    return `${baseRender}\n<div class="reacciones-container">${reactionsHtml}</div>`;
  }
}
