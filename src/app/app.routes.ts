import { Routes } from '@angular/router';
import { InicialComponent } from './pages/inicial/inicial.component';
import { AdminComponent } from './pages/admin/admin.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component'; // Importe aqui

export const routes: Routes = [
  { path: '', component: InicialComponent },
  { path: 'admin', component: AdminComponent },
  { path: 'dashboard', component: DashboardComponent } 
];