import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router'; // Adicionado o Router aqui
import { SupabaseService } from '../../services/supabase.service';

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

  // Formulário
  novoNome = '';
  novoCpf = '';
  termoBusca = '';

  // Estado da Interface
  tabelaVisivel = false;
  currentTime = '';
  private timeInterval: any;

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
    private router: Router 
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.atualizarRelogio();
      this.timeInterval = setInterval(() => this.atualizarRelogio(), 1000);
    }
  }

  ngOnDestroy() {
    if (this.timeInterval) clearInterval(this.timeInterval);
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  atualizarRelogio() {
    this.currentTime = new Date().toLocaleTimeString('pt-BR');
  }

  // 1. CORREÇÃO DO LOGIN UNIFICADO (ADMIN OU OPERADOR)
  async verificarSenha() {
    const entrada = this.adminPassword.trim();

    if (!entrada) {
      this.errorMessage = 'Por favor, insira uma credencial.';
      return;
    }

    // CASO A: É a senha mestre do Administrador
    if (entrada === 'admin123') { 
      this.isAuthorized = true;
      this.errorMessage = '';
      await this.carregarUsuarios(); // Carrega do banco real
      return;
    }

    // CASO B: Não é a senha admin, então testa se é um ID de Operador no Supabase
    try {
      const operario = await this.supabaseService.verificarId(entrada.toUpperCase());

      if (operario) {
        this.errorMessage = '';
        // MÁGICA DO ANGULAR: Redireciona o operador para a página de dashboard
        this.router.navigate(['/dashboard']);
      } else {
        this.errorMessage = 'ID ou Senha incorreta! Acesso negado.';
      }
    } catch (error) {
      this.errorMessage = 'Erro ao conectar com o banco de dados.';
    }
  }

  // 2. CARREGAR DO SUPABASE REAL
  async carregarUsuarios() {
    try {
      const dados = await this.supabaseService.listarOperarios();
      this.usuarios = dados || [];
      this.filtrarTabela();
    } catch (error) {
      this.exibirToast('Erro ao carregar usuários do banco.', 'error');
    }
  }

  // 3. SALVAR NO SUPABASE PERSISTENTE
  async criarConta() {
    if (!this.novoNome || !this.novoCpf) {
      this.exibirToast('Preencha o nome e o CPF do usuário.', 'error');
      return;
    }

    // Gerador de ID aleatório de 6 caracteres maiúsculos
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      // Cadastra na tabela do banco em tempo real
      const sucesso = await this.supabaseService.cadastrarOperario(id, this.novoNome, this.novoCpf);

      if (sucesso) {
        this.exibirToast(`Usuário "${this.novoNome}" criado — ID: ${id}`, 'success');
        
        this.novoNome = '';
        this.novoCpf = '';
        
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