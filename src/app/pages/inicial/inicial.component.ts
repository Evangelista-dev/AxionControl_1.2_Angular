import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-inicial',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inicial.component.html',
  styleUrl: './inicial.component.css'
})
export class InicialComponent implements OnInit, AfterViewInit, OnDestroy {

  // Variáveis controladas pelo Angular (Data Binding)
  tanques = [
    { id: 'Tanque-01', temp: 45, label: 'NORMAL', class: 'ok' },
    { id: 'Tanque-02', temp: 96, label: 'ATENÇÃO', class: 'warn' },
    { id: 'Tanque-03', temp: 22, label: 'Inativo', class: 'ok' }
  ];

  mensagensLog = [
    { msg: 'TK-001 temperatura estabilizada', badge: 'badge-ok', label: 'OK' },
    { msg: 'TK-002 requer atenção operacional', badge: 'badge-warn', label: 'ALERTA' },
    { msg: 'Misturador-01 ciclo concluído', badge: 'badge-ok', label: 'OK' },
    { msg: 'Sync de dados executado', badge: 'badge-ok', label: 'OK' },
  ];

  logsVisiveis: any[] = [];
  
  private logInterval: any;
  private tempInterval: any;
  private logIdx = 0;

  constructor(
    private el: ElementRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    // Inicializa os 3 primeiros logs
    this.logsVisiveis = [
      this.gerarLogMensagem(0),
      this.gerarLogMensagem(1),
      this.gerarLogMensagem(2)
    ];
    this.logIdx = 3;

    // PROTEÇÃO: INTERVALOS SÓ RODAM NO NAVEGADOR
    if (isPlatformBrowser(this.platformId)) {
      // Intervalo de Logs
      this.logInterval = setInterval(() => {
        const novoLog = this.gerarLogMensagem(this.logIdx % this.mensagensLog.length);
        this.logsVisiveis.unshift(novoLog); // Adiciona no começo
        this.logsVisiveis.pop(); // Remove o último
        this.logIdx++;
      }, 4000);

      // Intervalo de Temperaturas
      this.tempInterval = setInterval(() => {
        const baseTemps = [42, 96, 22];
        this.tanques.forEach((tanque, i) => {
          const variation = (Math.random() - 0.5) * 2;
          tanque.temp = Math.round(baseTemps[i] + variation);
        });
      }, 2500);
    }
  }

  // O ngAfterViewInit roda TODA VEZ que o Angular termina de desenhar o HTML desta página
  ngAfterViewInit(): void {
    // PROTEÇÃO: INTERSECTION OBSERVER SÓ RODA NO NAVEGADOR
    if (isPlatformBrowser(this.platformId)) {
      
      // setTimeout dá um tempinho (100ms) para o Angular desenhar a tela antes de observar
      setTimeout(() => {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              // Adiciona a classe que ativa a animação
              entry.target.classList.add('active'); 
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.1 }); // 0.1 exige que 10% do elemento apareça na tela para animar

        // Procura todos os elementos com a classe reveal
        const elements = this.el.nativeElement.querySelectorAll('.reveal');
        
        // Se encontrou, começa a observar cada um
        if (elements.length > 0) {
          elements.forEach((el: any) => observer.observe(el));
        }
      }, 100); 
    }
  }

  // A FUNÇÃO QUE ESTAVA FALTANDO PARA LIMPAR A MEMÓRIA
  ngOnDestroy(): void {
    if (this.logInterval) clearInterval(this.logInterval);
    if (this.tempInterval) clearInterval(this.tempInterval);
  }

  // A FUNÇÃO QUE ESTAVA FALTANDO PARA GERAR OS LOGS
  private gerarLogMensagem(index: number) {
    const logBase = this.mensagensLog[index];
    return {
      time: new Date().toLocaleTimeString('pt-BR'),
      msg: logBase.msg,
      badge: logBase.badge,
      label: logBase.label
    };
  }
}