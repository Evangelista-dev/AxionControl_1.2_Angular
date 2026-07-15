import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { TURNOS_PRESET, formatarHorarioTurno } from '../../utils/turno.util';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit, OnDestroy {
  // Controle de Acesso
  isAuthorized = false;
  adminPassword = '';
  errorMessage = '';
  termosAceitos = false;

  // Formulário
  novoNome = '';
  novoCpf = '';
  termoBusca = '';
  turnosPreset = TURNOS_PRESET;
  turnoPresetIndex = 0;
  turnoNome = TURNOS_PRESET[0].turno_nome;
  turnoInicio = TURNOS_PRESET[0].turno_inicio;
  turnoFim = TURNOS_PRESET[0].turno_fim;

  // Estado da Interface
  tabelaVisivel = false;
  currentTime = '';
  private timeInterval: any;
  private readonly aoRetomarTela = () => {
    if (this.isAuthorized && document.visibilityState === 'visible') {
      void this.carregarUsuarios();
    }
  };

  // Notificações (Toast)
  toastMessage = '';
  toastClass = '';
  toastVisible = false;
  private toastTimer: any;

  // Banco de Dados Conectado ao Supabase
  usuarios: any[] = [];
  usuariosFiltrados: any[] = [];

  // Injetando o Supabase e o Router do Angular
  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private supabaseService: SupabaseService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.route.queryParamMap.subscribe((params) => {
        if (params.get('destino') === 'dashboard') {
          void this.router.navigate(['/login']);
        }
      });

      if (this.authService.isAdminLoggedIn()) {
        this.isAuthorized = true;
        void this.carregarUsuarios();
      }

      this.atualizarRelogio();
      this.timeInterval = setInterval(() => this.atualizarRelogio(), 1000);
      document.addEventListener('visibilitychange', this.aoRetomarTela);
    }
  }

  ngOnDestroy() {
    if (this.timeInterval) clearInterval(this.timeInterval);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('visibilitychange', this.aoRetomarTela);
    }
  }

  atualizarRelogio() {
    this.currentTime = new Date().toLocaleTimeString('pt-BR');
  }


  async verificarSenha() {
   
    if (!this.termosAceitos) {
      this.errorMessage = 'Você precisa ler e aceitar os Termos e Condições.';
      return;
    }

    const entrada = this.adminPassword.trim();

   
    if (!entrada) {
      this.errorMessage = 'Informe a senha de administrador.';
      return;
    }

  
    if (entrada !== environment.adminPassword) {
      this.errorMessage = 'Senha de administrador incorreta.';
      return;
    }


    this.authService.clearOperador();
    this.isAuthorized = true;
    this.authService.setAdminSession();
    this.errorMessage = '';
    this.adminPassword = '';
    await this.carregarUsuarios();
}

  sairAdmin() {
    this.authService.clearAdmin();
    this.isAuthorized = false;
    this.usuarios = [];
    this.usuariosFiltrados = [];
    this.tabelaVisivel = false;
  }

  // 2. CARREGAR DO SUPABASE REAL
  async carregarUsuarios() {
    try {
      const dados = await this.supabaseService.listarOperarios();
      this.usuarios = [...(dados || [])];
      this.filtrarTabela();
    } catch (error) {
      this.exibirToast('Erro ao carregar usuários do banco.', 'error');
    }
  }

  // 3. SALVAR NO SUPABASE PERSISTENTE
  async criarConta() {
    if (!this.novoNome.trim() || !this.novoCpf.trim()) {
      this.exibirToast('Preencha o nome e o CPF do usuário.', 'error');
      return;
    }

    const cpfInformado = this.novoCpf.trim();
    const id = await this.gerarIdUnico();
    const turno = this.obterTurnoFormulario();

    if (!turno.turno_nome.trim() || !turno.turno_inicio || !turno.turno_fim) {
      this.exibirToast('Defina o nome e o horário do turno.', 'error');
      return;
    }

    try {
      const sucesso = await this.supabaseService.cadastrarOperario(
        id,
        this.novoNome.trim(),
        cpfInformado,
        turno
      );

      if (sucesso) {
        this.exibirToast(`Usuário "${this.novoNome}" criado — ID: ${id}`, 'success');
        
        this.novoNome = '';
        this.novoCpf = '';
        this.aplicarPresetTurno(0);
        
        // Atualiza a lista vinda da nuvem (garante que não some ao sair)
        await this.carregarUsuarios();
        
        if (!this.tabelaVisivel) this.alternarTabela();
      } else {
        this.exibirToast('Erro ao cadastrar. Verifique se o CPF já existe.', 'error');
      }
    } catch (error) {
      this.exibirToast('Falha na comunicação com o banco de dados.', 'error');
    }
  }

  // 4. DELETAR DO SUPABASE REAL
  async removerConta(id: string) {
    if (confirm('Tem certeza que deseja excluir este operador do banco de dados?')) {
      try {
        const sucesso = await this.supabaseService.deletarOperario(id);
        if (sucesso) {
          this.exibirToast('Usuário removido com sucesso.', 'success');
          await this.carregarUsuarios(); // Atualiza a tabela
        } else {
          this.exibirToast('Não foi possível remover o usuário.', 'error');
        }
      } catch (error) {
        this.exibirToast('Erro ao deletar no banco.', 'error');
      }
    }
  }

  // 5. RESETAR TABELA INTEIRA NO SUPABASE
  async resetarUsuarios() {
    if (confirm('ATENÇÃO: Isso vai apagar TODOS os usuários do sistema. Confirmar?')) {
       try {
         const sucesso = await this.supabaseService.limparTodosOperarios();
         if (sucesso) {
           this.usuarios = [];
           this.filtrarTabela();
           this.exibirToast('Todos os usuários foram removidos.', 'error');
           this.tabelaVisivel = false;
         } else {
           this.exibirToast('Falha ao limpar o banco.', 'error');
         }
       } catch (error) {
         this.exibirToast('Erro ao conectar com o banco.', 'error');
       }
    }
  }

  alternarTabela() {
    this.tabelaVisivel = !this.tabelaVisivel;
    if (this.tabelaVisivel) {
      this.carregarUsuarios();
    }
  }

  filtrarTabela() {
    if (!this.termoBusca) {
      this.usuariosFiltrados = [...this.usuarios];
    } else {
      const termo = this.termoBusca.toLowerCase();
      this.usuariosFiltrados = this.usuarios.filter(u =>
        (u.nome && u.nome.toLowerCase().includes(termo)) ||
        (u.cpf && u.cpf.includes(termo)) ||
        (u.id_gerado && u.id_gerado.toLowerCase().includes(termo))
      );
    }
  }

  formatarCpfExibicao(cpf: string): string {
    return cpf?.trim() || '—';
  }

  formatarHorarioUsuario(usuario: { turno_inicio?: string; turno_fim?: string }): string {
    const inicio = String(usuario.turno_inicio ?? '06:00').slice(0, 5);
    const fim = String(usuario.turno_fim ?? '14:00').slice(0, 5);
    return formatarHorarioTurno(inicio, fim);
  }

  aplicarPresetTurno(indice: number | string) {
    const index = Number(indice);

    if (index >= 0 && index < this.turnosPreset.length) {
      const preset = this.turnosPreset[index];
      this.turnoNome = preset.turno_nome;
      this.turnoInicio = preset.turno_inicio;
      this.turnoFim = preset.turno_fim;
      return;
    }

    this.turnoNome = 'Personalizado';
  }

  private obterTurnoFormulario() {
    return {
      turno_nome: this.turnoNome.trim(),
      turno_inicio: this.turnoInicio.slice(0, 5),
      turno_fim: this.turnoFim.slice(0, 5)
    };
  }

  private async gerarIdUnico(): Promise<string> {
    const existentes = await this.supabaseService.listarOperarios();
    const ids = new Set(existentes.map((operario) => String(operario.id_gerado).toUpperCase()));

    for (let tentativa = 0; tentativa < 20; tentativa++) {
      const id = Math.random().toString(36).substring(2, 8).toUpperCase();
      if (!ids.has(id)) {
        return id;
      }
    }

    return `${Date.now().toString(36).slice(-6).toUpperCase()}`;
  }

  exibirToast(msg: string, tipo: 'success' | 'error') {
    this.toastMessage = msg;
    this.toastClass = tipo;
    this.toastVisible = true;

    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
    }, 3000);
  }
}


