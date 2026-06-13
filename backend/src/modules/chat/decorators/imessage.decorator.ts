export interface IMensaje {
  getContenido(): string;
  getMetadata(): Record<string, any>;
  render(): string;
}

export type EstadoEncuesta = 'activa' | 'cerrada';

export interface OpcionEncuesta {
  id: string;
  texto: string;
  votos: string[];
}

export interface ConfiguracionEncuesta {
  pregunta: string;
  opciones: Array<string | { id?: string; texto: string; votos?: string[] }>;
  usuariosParticipantes?: string[];
  fechaCierre?: Date | string | null;
  estado?: EstadoEncuesta;
  votoMultiple?: boolean;
  maxSeleccion?: number;
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

export class MensajeConEncuesta extends MessageDecorator {
  private pregunta: string;
  private opciones: OpcionEncuesta[];
  private usuariosParticipantes: Set<string>;
  private fechaCierre: Date | null;
  private estado: EstadoEncuesta;
  private votoMultiple: boolean;
  private maxSeleccion: number;

  constructor(mensaje: IMensaje, encuesta: ConfiguracionEncuesta) {
    super(mensaje);

    const opcionesNormalizadas = encuesta.opciones.map((opcion, index) => {
      if (typeof opcion === 'string') {
        return {
          id: `opcion-${index + 1}`,
          texto: opcion.trim(),
          votos: [] as string[],
        };
      }

      return {
        id: opcion.id?.trim() || `opcion-${index + 1}`,
        texto: opcion.texto.trim(),
        votos: Array.from(new Set((opcion.votos || []).filter(Boolean))),
      };
    });

    if (opcionesNormalizadas.length < 2 || opcionesNormalizadas.length > 10) {
      throw new Error('La encuesta debe tener entre 2 y 10 opciones');
    }

    if (!encuesta.pregunta?.trim()) {
      throw new Error('La encuesta debe tener una pregunta válida');
    }

    this.pregunta = encuesta.pregunta.trim();
    this.opciones = opcionesNormalizadas;
    this.usuariosParticipantes = new Set((encuesta.usuariosParticipantes || []).filter(Boolean));
    this.fechaCierre = encuesta.fechaCierre ? new Date(encuesta.fechaCierre) : null;
    this.estado = encuesta.estado || 'activa';
    this.votoMultiple = Boolean(encuesta.votoMultiple);
    this.maxSeleccion = Math.max(1, encuesta.maxSeleccion || 1);

    if (!this.votoMultiple) {
      this.maxSeleccion = 1;
    }

    if (this.maxSeleccion > this.opciones.length) {
      this.maxSeleccion = this.opciones.length;
    }
  }

  private getVotosUsuario(userId: string) {
    return this.opciones.filter((opcion) => opcion.votos.includes(userId)).map((opcion) => opcion.id);
  }

  private getTotalVotos() {
    return this.opciones.reduce((acc, opcion) => acc + opcion.votos.length, 0);
  }

  registrarVoto(userId: string, opcionId: string): void {
    if (this.estado === 'cerrada') {
      throw new Error('No se puede votar en una encuesta cerrada');
    }

    if (this.fechaCierre && this.fechaCierre.getTime() <= Date.now()) {
      this.cerrarEncuesta();
      throw new Error('La encuesta ya expiró y no admite nuevos votos');
    }

    const opcion = this.opciones.find((item) => item.id === opcionId);
    if (!opcion) {
      throw new Error('La opción seleccionada no existe');
    }

    const votosPrevios = this.getVotosUsuario(userId);
    if (votosPrevios.includes(opcionId)) {
      throw new Error('No puedes votar dos veces en la misma opción');
    }

    if (!this.votoMultiple && votosPrevios.length > 0) {
      throw new Error('Esta encuesta permite un solo voto por usuario');
    }

    if (this.votoMultiple && votosPrevios.length >= this.maxSeleccion) {
      throw new Error(`Esta encuesta permite hasta ${this.maxSeleccion} opciones por usuario`);
    }

    opcion.votos.push(userId);
    this.usuariosParticipantes.add(userId);
  }

  cerrarEncuesta(): void {
    this.estado = 'cerrada';
    if (!this.fechaCierre) {
      this.fechaCierre = new Date();
    }
  }

  obtenerResultados() {
    const totalVotos = this.getTotalVotos();

    return this.opciones.map((opcion) => {
      const votos = opcion.votos.length;
      const porcentaje = totalVotos === 0 ? 0 : Number(((votos / totalVotos) * 100).toFixed(2));

      return {
        id: opcion.id,
        texto: opcion.texto,
        votos,
        porcentaje,
        usuarios: [...opcion.votos],
      };
    });
  }

  override getMetadata(): Record<string, any> {
    return {
      ...super.getMetadata(),
      encuesta: {
        pregunta: this.pregunta,
        opciones: this.opciones.map((opcion) => ({
          id: opcion.id,
          texto: opcion.texto,
          votos: [...opcion.votos],
        })),
        votosPorOpcion: this.obtenerResultados(),
        usuariosParticipantes: [...this.usuariosParticipantes],
        fechaCierre: this.fechaCierre?.toISOString() ?? null,
        estado: this.estado,
        votoMultiple: this.votoMultiple,
        maxSeleccion: this.maxSeleccion,
        totalVotos: this.getTotalVotos(),
      },
    };
  }

  override render(): string {
    const baseRender = super.render();
    const resultados = this.obtenerResultados();
    const estadoLabel = this.estado === 'cerrada' ? 'Cerrada' : 'Activa';
    const cierreLabel = this.fechaCierre
      ? this.fechaCierre.toLocaleString('es-CO', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'Sin cierre programado';

    const opcionesHtml = resultados
      .map(
        (opcion) =>
          `<div class="encuesta-opcion" data-option-id="${opcion.id}" data-votes="${opcion.votos}" data-percentage="${opcion.porcentaje}"><strong>${opcion.texto}</strong> <span>${opcion.votos} votos (${opcion.porcentaje}%)</span></div>`
      )
      .join('');

    return `${baseRender}\n<div class="encuesta-container" data-status="${this.estado}" data-multiple="${this.votoMultiple}" data-max-selections="${this.maxSeleccion}"><div class="encuesta-header"><span class="encuesta-estado">${estadoLabel}</span><span class="encuesta-cierre">${cierreLabel}</span></div><p class="encuesta-pregunta">${this.pregunta}</p>${opcionesHtml}</div>`;
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
