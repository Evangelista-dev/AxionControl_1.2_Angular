import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface OperadorSession {
  id_gerado: string;
  nome: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly OPERADOR_KEY = 'axiom_operador';
  private readonly ADMIN_KEY = 'axiom_admin';

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  setOperador(operario: OperadorSession): void {
    if (!this.isBrowser()) {
      return;
    }
    sessionStorage.setItem(this.OPERADOR_KEY, JSON.stringify(operario));
  }

  getOperador(): OperadorSession | null {
    if (!this.isBrowser()) {
      return null;
    }

    const raw = sessionStorage.getItem(this.OPERADOR_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as OperadorSession;
    } catch {
      return null;
    }
  }

  isOperadorLoggedIn(): boolean {
    return this.getOperador() !== null;
  }

  setAdminSession(): void {
    if (!this.isBrowser()) {
      return;
    }
    sessionStorage.setItem(this.ADMIN_KEY, 'true');
  }

  isAdminLoggedIn(): boolean {
    if (!this.isBrowser()) {
      return false;
    }
    return sessionStorage.getItem(this.ADMIN_KEY) === 'true';
  }

  clearOperador(): void {
    if (!this.isBrowser()) {
      return;
    }
    sessionStorage.removeItem(this.OPERADOR_KEY);
  }

  clearAdmin(): void {
    if (!this.isBrowser()) {
      return;
    }
    sessionStorage.removeItem(this.ADMIN_KEY);
  }

  logout(): void {
    this.clearOperador();
    this.clearAdmin();
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
