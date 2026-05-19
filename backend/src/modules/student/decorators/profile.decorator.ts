export interface IPerfil {
  toJSON(): Record<string, any>;
}

export class PerfilBase implements IPerfil {
  constructor(
    public id: string,
    public name: string,
    public email: string,
    public avatarUrl: string | null,
    public career: string | null,
    public currentSemester: number | null,
    public subjects: any[]
  ) {}

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      avatarUrl: this.avatarUrl,
      career: this.career,
      currentSemester: this.currentSemester,
      subjects: this.subjects,
    };
  }
}

export abstract class PerfilDecorator implements IPerfil {
  constructor(protected perfil: IPerfil) {}

  toJSON(): Record<string, any> {
    return this.perfil.toJSON();
  }
}

export interface StudentStats {
  gruposCreados: number;
  gruposParticipa: number;
  mensajesEnviados: number;
}

export class PerfilConEstadisticas extends PerfilDecorator {
  constructor(
    perfil: IPerfil,
    private stats: StudentStats
  ) {
    super(perfil);
  }

  override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      stats: this.stats,
    };
  }
}

export class PerfilConInsignias extends PerfilDecorator {
  constructor(
    perfil: IPerfil,
    private insignias: string[]
  ) {
    super(perfil);
  }

  override toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      insignias: this.insignias,
    };
  }
}
