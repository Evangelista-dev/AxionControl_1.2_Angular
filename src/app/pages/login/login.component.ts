import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  operadorId = '';
  errorMessage = '';
  carregando = false;
  termosAceitos = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private authService: AuthService,
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (this.authService.isOperadorLoggedIn()) {
      void this.router.navigate(['/dashboard']);
    }
  }
async entrar() {
  
    if (!this.termosAceitos) {
      this.errorMessage = 'Você precisa ler e aceitar os Termos e Condições.';
      return;
    }

    const id = this.operadorId.trim().toUpperCase();

    
    if (!id) {
      this.errorMessage = 'Informe seu ID de operador.';
      return;
    }

    this.carregando = true;
    this.errorMessage = '';

    try {
      const operario = await this.supabaseService.verificarId(id);

      if (!operario) {
        this.errorMessage =
          'ID não encontrado. Peça ao administrador para criar seu cadastro ou confira se digitou corretamente (ex.: AX101).';
        return;
      }

      this.authService.clearAdmin();
      this.authService.setOperador({
        id_gerado: String(operario.id_gerado),
        nome: String(operario.nome)
      });

      await this.router.navigate(['/dashboard']);
    } catch {
      this.errorMessage = 'Erro ao conectar com o banco de dados. Tente novamente.';
    } finally {
      this.carregando = false;
    }
  }
}
